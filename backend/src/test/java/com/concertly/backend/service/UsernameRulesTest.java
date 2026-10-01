package com.concertly.backend.service;

import com.concertly.backend.dto.request.UpdateProfileRequest;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** N-21: kullanıcı adı kuralı — yalnızca yeni ad yazılırken uygulanır. */
class UsernameRulesTest {

    @ParameterizedTest
    @ValueSource(strings = {"emre", "sim_social_02", "claude_debug", "a.b", "abc", "x2345678901234567890", "  Emre  "})
    void validNamesAreAcceptedAndNormalized(String raw) {
        String u = UsernameRules.requireValid(raw);
        assertEquals(raw.trim().toLowerCase(), u);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "ab", "12345", "_._", "sim audit", "çiğdem", "emre!", "x23456789012345678901", "a-b"})
    void invalidNamesAreRejected(String raw) {
        assertThrows(IllegalArgumentException.class, () -> UsernameRules.requireValid(raw), raw);
    }

    @Test
    void nullIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> UsernameRules.requireValid(null));
    }

    // ── Ayarlar: ad değişmediyse eski (kurala uymayan) ad korunur ────────────

    private static final BCryptPasswordEncoder ENCODER = new BCryptPasswordEncoder(4);

    private static UserService serviceWith(UserRepository users) {
        return new UserService(users, mock(PostRepository.class), mock(LikeRepository.class),
                mock(CommentRepository.class), mock(EventVerificationRepository.class),
                mock(BingoCardRepository.class), mock(BadgeService.class), mock(ConcertAttendanceService.class),
                ENCODER, mock(com.concertly.backend.repository.FollowRepository.class));
    }

    private static User legacyUser() {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", 6L);
        u.setUsername("Tanrınınkırbacı");
        u.setEmail("d@test.local");
        u.setPassword(ENCODER.encode("sifre123"));
        return u;
    }

    @Test
    void unchangedLegacyUsernameStillSavesOtherFields() {
        UserRepository users = mock(UserRepository.class);
        User user = legacyUser();
        when(users.findById(6L)).thenReturn(Optional.of(user));
        when(users.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        UpdateProfileRequest req = new UpdateProfileRequest();
        req.setUsername("Tanrınınkırbacı");
        req.setCity("Ankara");

        serviceWith(users).updateProfile(6L, req);

        assertEquals("Tanrınınkırbacı", user.getUsername(), "değişmeyen ad olduğu gibi kalır");
        assertEquals("Ankara", user.getCity());
    }

    @Test
    void changedUsernameMustFollowTheRule() {
        UserRepository users = mock(UserRepository.class);
        User user = legacyUser();
        when(users.findById(6L)).thenReturn(Optional.of(user));
        when(users.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        UserService service = serviceWith(users);

        UpdateProfileRequest bad = new UpdateProfileRequest();
        bad.setUsername("12345");
        bad.setCurrentPassword("sifre123");
        assertThrows(IllegalArgumentException.class, () -> service.updateProfile(6L, bad));
        assertEquals("Tanrınınkırbacı", user.getUsername());

        UpdateProfileRequest good = new UpdateProfileRequest();
        good.setUsername("  Yeni_Ad ");
        good.setCurrentPassword("sifre123");
        service.updateProfile(6L, good);
        assertEquals("yeni_ad", user.getUsername());
    }
}
