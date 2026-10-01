package com.concertly.backend.security;

import com.concertly.backend.model.User;
import com.concertly.backend.repository.UserRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** SEC-08b: erişim token'ı kullanıcıyı e-postayla değil id ile eşler. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class JwtFilterUserIdTest {

    private static final String SECRET = "test-secret-key-that-is-at-least-32-characters-long";

    @Mock private UserRepository userRepository;

    private JwtUtil jwtUtil;
    private JwtFilter filter;

    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil(SECRET, 3_600_000L);
        filter = new JwtFilter(jwtUtil, new UserDetailsServiceImpl(userRepository));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private User user(long id, String email, Boolean active) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setEmail(email);
        u.setPassword("hash");
        u.setIsActive(active);
        return u;
    }

    private Authentication run(String token) throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/posts");
        req.addHeader("Authorization", "Bearer " + token);
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(req, new MockHttpServletResponse(), chain);
        assertNotNull(chain.getRequest(), "istek her durumda zincire devam eder");
        return SecurityContextHolder.getContext().getAuthentication();
    }

    @Test
    void extractUserIdParsesNumericPrefix() {
        assertEquals(42L, jwtUtil.extractUserId(jwtUtil.generateToken(42L, "a@b")));
    }

    @Test
    void extractUserIdReturnsNullForLegacyAndGarbageSubjects() {
        assertNull(jwtUtil.extractUserId(rawToken("a@b")));
        assertNull(jwtUtil.extractUserId(rawToken("abc:a@b")));
        assertNull(jwtUtil.extractUserId(rawToken(":a@b")));
    }

    @Test
    void authenticatesByIdEvenWhenTokenEmailIsStale() throws Exception {
        String token = jwtUtil.generateToken(1L, "old@test.com");
        when(userRepository.findById(1L)).thenReturn(Optional.of(user(1L, "new@test.com", true)));

        Authentication auth = run(token);

        assertNotNull(auth);
        assertEquals("1:new@test.com", auth.getName());
    }

    @Test
    void doesNotAuthenticateAsAccountThatNowOwnsTheOldEmail() throws Exception {
        String token = jwtUtil.generateToken(1L, "old@test.com");
        when(userRepository.findById(1L)).thenReturn(Optional.of(user(1L, "new@test.com", true)));
        when(userRepository.findByEmail("old@test.com")).thenReturn(Optional.of(user(2L, "old@test.com", true)));

        Authentication auth = run(token);

        assertNotNull(auth);
        assertTrue(auth.getName().startsWith("1:"), "asla B hesabı olmamalı");
        verify(userRepository, never()).findByEmail(any());
    }

    @Test
    void unknownIdIsNotAuthenticated() throws Exception {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());
        assertNull(run(jwtUtil.generateToken(99L, "x@test.com")));
    }

    @Test
    void legacyTokenWithoutIdIsNotAuthenticated() throws Exception {
        assertNull(run(rawToken("x@test.com")));
        verifyNoInteractions(userRepository);
    }

    @Test
    void disabledUserIsNotAuthenticated() throws Exception {
        when(userRepository.findById(5L)).thenReturn(Optional.of(user(5L, "ban@test.com", false)));
        assertNull(run(jwtUtil.generateToken(5L, "ban@test.com")));
    }

    @Test
    void purposeTokenIsStillRejected() throws Exception {
        String token = jwtUtil.generatePurposeToken(1L, "spotify", 60_000L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user(1L, "a@test.com", true)));
        assertNull(run(token));
        verifyNoInteractions(userRepository);
    }

    private String rawToken(String subject) {
        return Jwts.builder()
                .subject(subject)
                .expiration(new Date(System.currentTimeMillis() + 60_000L))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                .compact();
    }
}
