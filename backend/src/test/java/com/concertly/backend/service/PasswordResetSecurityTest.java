package com.concertly.backend.service;

import com.concertly.backend.model.User;
import com.concertly.backend.repository.ArtistFollowRepository;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.UserRepository;
import com.concertly.backend.security.AuthRateLimiter;
import com.concertly.backend.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Şifre sıfırlama kaba kuvvete kapalı olmalı: kod özetle saklanır, 5 yanlışta yanar, istekler sınırlı. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PasswordResetSecurityTest {

    @Mock private UserRepository userRepository;
    @Mock private ArtistRepository artistRepository;
    @Mock private ArtistFollowRepository artistFollowRepository;
    @Mock private JwtUtil jwtUtil;
    @Mock private AuthenticationManager authenticationManager;
    @Mock private RefreshTokenService refreshTokenService;
    @Mock private EmailService emailService;
    @Mock private EmailVerificationService emailVerificationService;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private AuthService service;
    private User user;

    @BeforeEach
    void setUp() {
        service = new AuthService(userRepository, artistRepository, artistFollowRepository, encoder, jwtUtil,
                authenticationManager, refreshTokenService, emailService, emailVerificationService,
                new AuthRateLimiter());
        user = new User();
        user.setEmail("kurban@test.com");
        user.setPassword(encoder.encode("eskiSifre1"));
        when(userRepository.findByEmail("kurban@test.com")).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private String requestCode() {
        service.forgotPassword("kurban@test.com", "1.1.1.1");
        ArgumentCaptor<String> code = ArgumentCaptor.forClass(String.class);
        verify(emailService, atLeastOnce()).sendPasswordResetCode(eq("kurban@test.com"), code.capture());
        return code.getValue();
    }

    private static String wrong(String code) {
        return code.equals("000000") ? "111111" : "000000";
    }

    @Test
    void codeIsStoredOnlyAsHash() {
        String code = requestCode();
        assertNotEquals(code, user.getResetToken());
        assertTrue(encoder.matches(code, user.getResetToken()));
        assertEquals(0, user.getResetTokenAttempts());
    }

    @Test
    void fiveWrongAttemptsBurnTheCodeEvenForTheCorrectOne() {
        String code = requestCode();
        for (int i = 0; i < AuthService.RESET_MAX_ATTEMPTS; i++) {
            ResponseStatusException e = assertThrows(ResponseStatusException.class,
                    () -> service.resetPassword("kurban@test.com", wrong(code), "yeniSifre1", "1.1.1.1"));
            assertEquals("CODE_INVALID", e.getReason());
        }
        assertEquals(AuthService.RESET_MAX_ATTEMPTS, user.getResetTokenAttempts());

        ResponseStatusException burned = assertThrows(ResponseStatusException.class,
                () -> service.resetPassword("kurban@test.com", code, "yeniSifre1", "1.1.1.1"));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, burned.getStatusCode());
        assertEquals("CODE_ATTEMPTS_EXCEEDED", burned.getReason());
        assertTrue(encoder.matches("eskiSifre1", user.getPassword()), "şifre değişmemeli");
    }

    @Test
    void correctCodeChangesPasswordAndRevokesSessions() {
        String code = requestCode();
        service.resetPassword("kurban@test.com", code, "yeniSifre1", "1.1.1.1");
        assertTrue(encoder.matches("yeniSifre1", user.getPassword()));
        assertNull(user.getResetToken());
        assertNull(user.getResetTokenAttempts());
        verify(refreshTokenService).deleteByUser(user);
    }

    @Test
    void expiredCodeIsRejected() {
        String code = requestCode();
        user.setResetTokenExpiry(LocalDateTime.now().minusMinutes(1));
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> service.resetPassword("kurban@test.com", code, "yeniSifre1", "1.1.1.1"));
        assertEquals("CODE_EXPIRED", e.getReason());
    }

    @Test
    void unknownEmailLooksLikeAWrongCodeNot404() {
        when(userRepository.findByEmail("yok@test.com")).thenReturn(Optional.empty());
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> service.resetPassword("yok@test.com", "123456", "yeniSifre1", "1.1.1.1"));
        assertEquals("CODE_INVALID", e.getReason());
    }

    @Test
    void forgotPasswordIsRateLimitedPerEmailSilently() {
        for (int i = 0; i < 10; i++) service.forgotPassword("kurban@test.com", "1.1.1." + i);
        // İlk FORGOT_PER_EMAIL istek mail atar; gerisi sessizce yutulur (mail bombası yok)
        verify(emailService, times(AuthService.FORGOT_PER_EMAIL)).sendPasswordResetCode(eq("kurban@test.com"), anyString());
    }

    @Test
    void resetEndpointIsRateLimitedPerEmailEvenFromManyIps() {
        requestCode();
        for (int i = 0; i < AuthService.RESET_PER_EMAIL; i++) {
            final int n = i;
            assertThrows(ResponseStatusException.class,
                    () -> service.resetPassword("kurban@test.com", "999999", "yeniSifre1", "9.9.9." + n));
        }
        ResponseStatusException limited = assertThrows(ResponseStatusException.class,
                () -> service.resetPassword("kurban@test.com", "999999", "yeniSifre1", "8.8.8.8"));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, limited.getStatusCode());
        assertEquals(AuthRateLimiter.TOO_MANY, limited.getReason());
    }
}
