package com.concertly.backend.service;

import com.concertly.backend.model.User;
import com.concertly.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Kayıt doğrulama kodu: doğru kod hesabı açar, yanlış/eski/çok denenen kod açmaz. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class EmailVerificationServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private EmailService emailService;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private EmailVerificationService service;
    private User user;

    @BeforeEach
    void setUp() {
        service = new EmailVerificationService(userRepository, encoder, emailService);
        ReflectionTestUtils.setField(service, "codeMinutes", 15);
        ReflectionTestUtils.setField(service, "resendSeconds", 60);
        ReflectionTestUtils.setField(service, "maxAttempts", 5);

        user = new User();
        ReflectionTestUtils.setField(user, "id", 7L);
        user.setEmail("emre@mail.com");
        user.setUsername("emre");
        when(userRepository.findByEmail("emre@mail.com")).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    /** start() ile kod üretir, e-postaya giden düz kodu yakalar. */
    private String startAndCaptureCode() {
        service.start(user);
        ArgumentCaptor<String> code = ArgumentCaptor.forClass(String.class);
        verify(emailService, atLeastOnce()).sendVerificationCode(eq("emre@mail.com"), eq("emre"), code.capture(), eq(15));
        return code.getValue();
    }

    private static String reason(ResponseStatusException e) {
        return e.getReason();
    }

    @Test
    void startMarksPendingAndStoresOnlyHash() {
        String code = startAndCaptureCode();
        assertTrue(code.matches("\\d{6}"));
        assertTrue(user.isEmailVerificationPending());
        assertNotEquals(code, user.getEmailVerificationCodeHash());
        assertTrue(encoder.matches(code, user.getEmailVerificationCodeHash()));
    }

    @Test
    void correctCodeVerifiesAndClearsState() {
        String code = startAndCaptureCode();
        User result = service.verify("emre@mail.com", code);
        assertEquals(Boolean.TRUE, result.getEmailVerified());
        assertFalse(result.isEmailVerificationPending());
        assertNull(result.getEmailVerificationCodeHash());
    }

    @Test
    void wrongCodeIsRejectedAndCounted() {
        startAndCaptureCode();
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> service.verify("emre@mail.com", "000000x"));
        assertEquals("CODE_INVALID", reason(e));
        assertEquals(1, user.getEmailVerificationAttempts());
        assertTrue(user.isEmailVerificationPending());
    }

    @Test
    void tooManyAttemptsBlocksEvenCorrectCode() {
        String code = startAndCaptureCode();
        user.setEmailVerificationAttempts(5);
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> service.verify("emre@mail.com", code));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, e.getStatusCode());
        assertEquals("CODE_ATTEMPTS_EXCEEDED", reason(e));
    }

    @Test
    void expiredCodeIsRejected() {
        String code = startAndCaptureCode();
        user.setEmailVerificationExpiry(LocalDateTime.now().minusMinutes(1));
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> service.verify("emre@mail.com", code));
        assertEquals("CODE_EXPIRED", reason(e));
    }

    @Test
    void legacyAccountCannotBeUsedToGetTokens() {
        // email_verified NULL = eski hesap; verify-email şifresiz giriş kapısı olmamalı
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> service.verify("emre@mail.com", "123456"));
        assertEquals("CODE_INVALID", reason(e));
    }

    @Test
    void unknownEmailLooksLikeWrongCode() {
        when(userRepository.findByEmail("yok@mail.com")).thenReturn(Optional.empty());
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> service.verify("yok@mail.com", "123456"));
        assertEquals("CODE_INVALID", reason(e));
    }

    @Test
    void resendRespectsCooldown() {
        startAndCaptureCode();
        service.resend("emre@mail.com");                   // 60 sn dolmadı → yok sayılır
        verify(emailService, times(1)).sendVerificationCode(any(), any(), any(), anyInt());

        user.setEmailVerificationSentAt(LocalDateTime.now().minusSeconds(61));
        service.resend("emre@mail.com");
        verify(emailService, times(2)).sendVerificationCode(any(), any(), any(), anyInt());
    }

    @Test
    void resendIgnoresVerifiedAndUnknownAccounts() {
        service.resend("emre@mail.com");                   // NULL = doğrulanmış eski hesap
        when(userRepository.findByEmail("yok@mail.com")).thenReturn(Optional.empty());
        service.resend("yok@mail.com");
        verify(emailService, never()).sendVerificationCode(any(), any(), any(), anyInt());
    }
}
