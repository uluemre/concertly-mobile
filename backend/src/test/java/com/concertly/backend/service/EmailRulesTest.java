package com.concertly.backend.service;

import com.concertly.backend.dto.request.RegisterRequest;
import com.concertly.backend.exception.AlreadyExistsException;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.ArtistFollowRepository;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.UserRepository;
import com.concertly.backend.security.AuthRateLimiter;
import com.concertly.backend.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** N-22: e-posta kırpılır, küçük harfe çevrilir, biçimi doğrulanır; aramalar harf büyüklüğüne duyarsız. */
class EmailRulesTest {

    @ParameterizedTest
    @ValueSource(strings = {"emre@mail.com", "  Emre@Mail.COM ", "sim_social_02@test.local", "a.b+c@x.co"})
    void validAddressesAreAcceptedAndNormalized(String raw) {
        assertEquals(raw.trim().toLowerCase(), EmailRules.requireValid(raw));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   ", "emre", "emre@", "@mail.com", "emre@mail", "emre@mail.c", "em re@mail.com", "a@b@c.com"})
    void invalidAddressesAreRejected(String raw) {
        assertThrows(IllegalArgumentException.class, () -> EmailRules.requireValid(raw), raw);
    }

    @Test
    void nullAndTooLongAreRejected() {
        assertThrows(IllegalArgumentException.class, () -> EmailRules.requireValid(null));
        assertThrows(IllegalArgumentException.class, () -> EmailRules.requireValid("a".repeat(250) + "@x.com"));
    }

    // ── UserRepository.findByEmailNormalized ─────────────────────────────────

    private static User user(long id, String email) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setEmail(email);
        u.setUsername("u" + id);
        return u;
    }

    private static UserRepository repo() {
        UserRepository users = mock(UserRepository.class);
        when(users.findByEmailNormalized(any())).thenCallRealMethod();
        when(users.findByEmail(anyString())).thenReturn(Optional.empty());
        return users;
    }

    @Test
    void lookupTrimsAndIgnoresCase() {
        UserRepository users = repo();
        User legacy = user(1, "Emre@Mail.com");
        when(users.findAllByEmailIgnoreCase("emre@mail.com ".trim())).thenReturn(List.of(legacy));

        assertSame(legacy, users.findByEmailNormalized("  emre@mail.com ").orElseThrow());
        assertTrue(users.findByEmailNormalized(null).isEmpty());
        assertTrue(users.findByEmailNormalized("  ").isEmpty());
    }

    @Test
    void exactMatchWinsAndAmbiguousLegacyMatchIsNotGuessed() {
        UserRepository users = repo();
        User a = user(1, "Emre@mail.com");
        User b = user(2, "emre@mail.com");
        when(users.findByEmail("emre@mail.com")).thenReturn(Optional.of(b));
        when(users.findAllByEmailIgnoreCase(anyString())).thenReturn(List.of(a, b));

        assertSame(b, users.findByEmailNormalized("emre@mail.com").orElseThrow(), "birebir eşleşme önce");
        assertTrue(users.findByEmailNormalized("EMRE@mail.com").isEmpty(), "iki aday varsa tahmin edilmez");
    }

    // ── Kayıt ────────────────────────────────────────────────────────────────

    private static AuthService authService(UserRepository users) {
        EmailVerificationService verification = mock(EmailVerificationService.class);
        return new AuthService(users, mock(ArtistRepository.class), mock(ArtistFollowRepository.class),
                new BCryptPasswordEncoder(4), mock(JwtUtil.class), mock(AuthenticationManager.class),
                mock(RefreshTokenService.class), mock(EmailService.class), verification, new AuthRateLimiter());
    }

    private static RegisterRequest request(String email) {
        RegisterRequest r = new RegisterRequest();
        r.setUsername("sim_test");
        r.setEmail(email);
        r.setPassword("abc123");
        return r;
    }

    @Test
    void registerStoresLowercaseAndRejectsBadFormat() {
        UserRepository users = repo();
        when(users.findByUsername(anyString())).thenReturn(Optional.empty());
        when(users.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            ReflectionTestUtils.setField(u, "id", 9L);
            return u;
        });
        AuthService service = authService(users);

        assertEquals("sim_test@test.local", service.register(request("  Sim_Test@Test.Local ")).getEmail());
        assertThrows(IllegalArgumentException.class, () -> service.register(request("sim_test")));
        verify(users, times(1)).save(any());
    }

    @Test
    void registerTreatsDifferentCaseAsTheSameAddress() {
        UserRepository users = repo();
        User existing = user(1, "Sim_Test@test.local");
        existing.setEmailVerified(true);
        when(users.findAllByEmailIgnoreCase("sim_test@test.local")).thenReturn(List.of(existing));

        assertThrows(AlreadyExistsException.class, () -> authService(users).register(request("sim_test@test.local")));
        verify(users, never()).save(any());
    }
}
