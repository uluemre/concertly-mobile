package com.concertly.backend.security;

import com.concertly.backend.dto.request.LoginRequest;
import com.concertly.backend.model.RefreshToken;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.ArtistFollowRepository;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.UserRepository;
import com.concertly.backend.service.AuthService;
import com.concertly.backend.service.EmailService;
import com.concertly.backend.service.EmailVerificationService;
import com.concertly.backend.service.RefreshTokenService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Yasaklanan kullanıcı giriş yapamaz, token'ı filtreden geçmez, oturumunu yenileyemez. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BannedUserTest {

    @Mock private UserRepository userRepository;
    @Mock private ArtistRepository artistRepository;
    @Mock private ArtistFollowRepository artistFollowRepository;
    @Mock private JwtUtil jwtUtil;
    @Mock private AuthenticationManager authenticationManager;
    @Mock private RefreshTokenService refreshTokenService;
    @Mock private EmailService emailService;
    @Mock private EmailVerificationService emailVerificationService;

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private User user(Boolean active) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", 7L);
        u.setEmail("yasakli@test.com");
        u.setPassword("hash");
        u.setIsActive(active);
        return u;
    }

    private AuthService authService() {
        return new AuthService(userRepository, artistRepository, artistFollowRepository,
                new BCryptPasswordEncoder(4), jwtUtil, authenticationManager, refreshTokenService,
                emailService, emailVerificationService, new AuthRateLimiter());
    }

    @Test
    void userDetailsAreDisabledOnlyForBannedAccounts() {
        UserDetailsServiceImpl uds = new UserDetailsServiceImpl(userRepository);
        when(userRepository.findByEmail("yasakli@test.com")).thenReturn(Optional.of(user(false)));
        assertFalse(uds.loadUserByUsername("yasakli@test.com").isEnabled());

        when(userRepository.findByEmail("yasakli@test.com")).thenReturn(Optional.of(user(true)));
        assertTrue(uds.loadUserByUsername("yasakli@test.com").isEnabled());

        // Eski kayıt (null) aktif sayılır — kimse yanlışlıkla kilitlenmesin
        when(userRepository.findByEmail("yasakli@test.com")).thenReturn(Optional.of(user(null)));
        assertTrue(uds.loadUserByUsername("yasakli@test.com").isEnabled());
    }

    @Test
    void bannedUserCannotLogIn() {
        when(authenticationManager.authenticate(any())).thenThrow(new DisabledException("disabled"));
        LoginRequest req = new LoginRequest();
        ReflectionTestUtils.setField(req, "email", "yasakli@test.com");
        ReflectionTestUtils.setField(req, "password", "dogruSifre");

        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> authService().login(req, "1.1.1.1"));
        assertEquals(HttpStatus.FORBIDDEN, e.getStatusCode());
        assertEquals("ACCOUNT_BANNED", e.getReason());
        verify(jwtUtil, never()).generateToken(any(), any());
    }

    @Test
    void bannedUserCannotRefreshAndTokenIsDeleted() {
        RefreshToken token = new RefreshToken();
        token.setToken("rt-1");
        token.setUser(user(false));
        when(refreshTokenService.findByToken("rt-1")).thenReturn(Optional.of(token));
        when(refreshTokenService.isExpired(token)).thenReturn(false);

        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> authService().refreshToken("rt-1"));
        assertEquals("ACCOUNT_BANNED", e.getReason());
        verify(refreshTokenService).delete(token);
        verify(jwtUtil, never()).generateToken(any(), any());
    }

    @Test
    void jwtFilterRejectsStillValidAccessTokenOfBannedUser() throws Exception {
        org.springframework.security.core.userdetails.UserDetailsService uds = mock(
                org.springframework.security.core.userdetails.UserDetailsService.class);
        UserDetails disabled = new org.springframework.security.core.userdetails.User(
                "7:yasakli@test.com", "hash", false, true, true, true, List.of());
        when(uds.loadUserByUsername("yasakli@test.com")).thenReturn(disabled);
        when(jwtUtil.isTokenValid("tok")).thenReturn(true);
        when(jwtUtil.extractEmail("tok")).thenReturn("yasakli@test.com");

        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/posts");
        req.addHeader("Authorization", "Bearer tok");
        MockFilterChain chain = new MockFilterChain();
        new JwtFilter(jwtUtil, uds).doFilter(req, new MockHttpServletResponse(), chain);

        assertNull(SecurityContextHolder.getContext().getAuthentication(), "yasaklı kullanıcı kimliklendirilmemeli");
        assertNotNull(chain.getRequest(), "istek zincire devam eder, SecurityConfig 401 döner");
    }

    @Test
    void jwtFilterStillAuthenticatesActiveUser() throws Exception {
        org.springframework.security.core.userdetails.UserDetailsService uds = mock(
                org.springframework.security.core.userdetails.UserDetailsService.class);
        UserDetails active = new org.springframework.security.core.userdetails.User(
                "7:aktif@test.com", "hash", true, true, true, true, List.of());
        when(uds.loadUserByUsername("aktif@test.com")).thenReturn(active);
        when(jwtUtil.isTokenValid("tok")).thenReturn(true);
        when(jwtUtil.extractEmail("tok")).thenReturn("aktif@test.com");

        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/posts");
        req.addHeader("Authorization", "Bearer tok");
        new JwtFilter(jwtUtil, uds).doFilter(req, new MockHttpServletResponse(), new MockFilterChain());

        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
    }
}
