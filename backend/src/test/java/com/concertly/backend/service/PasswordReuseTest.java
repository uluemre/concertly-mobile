package com.concertly.backend.service;

import com.concertly.backend.model.User;
import com.concertly.backend.repository.ArtistFollowRepository;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.UserRepository;
import com.concertly.backend.security.AuthRateLimiter;
import com.concertly.backend.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** N-58: yeni şifre eskisiyle aynı olamaz (sıfırlama ve değiştirme). */
class PasswordReuseTest {

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private UserRepository users;
    private EmailService email;
    private RefreshTokenService refreshTokens;
    private AuthService service;
    private User user;

    @BeforeEach
    void setUp() {
        users = mock(UserRepository.class);
        email = mock(EmailService.class);
        refreshTokens = mock(RefreshTokenService.class);
        service = new AuthService(users, mock(ArtistRepository.class), mock(ArtistFollowRepository.class), encoder,
                mock(JwtUtil.class), mock(AuthenticationManager.class), refreshTokens, email,
                mock(EmailVerificationService.class), new AuthRateLimiter());
        user = new User();
        ReflectionTestUtils.setField(user, "id", 3L);
        user.setEmail("sim@test.local");
        user.setPassword(encoder.encode("eskiSifre1"));
        when(users.findById(3L)).thenReturn(Optional.of(user));
        when(users.findByEmail("sim@test.local")).thenReturn(Optional.of(user));
        when(users.findByEmailNormalized(any())).thenCallRealMethod();
        when(users.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void resetRejectsTheOldPasswordButKeepsTheCodeUsable() {
        service.forgotPassword("sim@test.local", "1.1.1.1");
        ArgumentCaptor<String> code = ArgumentCaptor.forClass(String.class);
        verify(email).sendPasswordResetCode(eq("sim@test.local"), code.capture());

        ResponseStatusException same = assertThrows(ResponseStatusException.class,
                () -> service.resetPassword("sim@test.local", code.getValue(), "eskiSifre1", "1.1.1.1"));
        assertEquals("SAME_PASSWORD", same.getReason());
        assertEquals(0, user.getResetTokenAttempts(), "kod yakılmaz");

        service.resetPassword("sim@test.local", code.getValue(), "yeniSifre1", "1.1.1.1");
        assertTrue(encoder.matches("yeniSifre1", user.getPassword()));
    }

    @Test
    void changeRejectsTheCurrentPasswordAsTheNewOne() {
        ResponseStatusException same = assertThrows(ResponseStatusException.class,
                () -> service.changePassword(3L, "eskiSifre1", "eskiSifre1"));
        assertEquals("SAME_PASSWORD", same.getReason());
        verify(refreshTokens, never()).deleteByUser(any());

        service.changePassword(3L, "eskiSifre1", "yeniSifre1");
        assertTrue(encoder.matches("yeniSifre1", user.getPassword()));
    }
}
