package com.concertly.backend.service;

import com.concertly.backend.dto.request.UpdateProfileRequest;
import com.concertly.backend.exception.AlreadyExistsException;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** N-25: kullanıcı adı / e-posta değişikliği mevcut şifre ister; çakışma açık 409 döner. */
class ProfileIdentityChangeTest {

    private static final BCryptPasswordEncoder ENCODER = new BCryptPasswordEncoder(4);

    private UserRepository users;
    private UserService service;
    private User user;

    @BeforeEach
    void setUp() {
        users = mock(UserRepository.class);
        service = new UserService(users, mock(PostRepository.class), mock(LikeRepository.class),
                mock(CommentRepository.class), mock(EventVerificationRepository.class),
                mock(BingoCardRepository.class), mock(BadgeService.class), mock(ConcertAttendanceService.class),
                ENCODER);
        user = new User();
        ReflectionTestUtils.setField(user, "id", 5L);
        user.setUsername("emre");
        user.setEmail("emre@mail.com");
        user.setCity("İstanbul");
        user.setPassword(ENCODER.encode("sifre123"));
        when(users.findById(5L)).thenReturn(Optional.of(user));
        when(users.findByUsername(any())).thenReturn(Optional.empty());
        when(users.findAllByEmailIgnoreCase(any())).thenReturn(List.of());
        when(users.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static UpdateProfileRequest form(String username, String email, String password) {
        UpdateProfileRequest r = new UpdateProfileRequest();
        r.setUsername(username);
        r.setEmail(email);
        r.setCity("Ankara");
        r.setCurrentPassword(password);
        return r;
    }

    private static String reason(Runnable call) {
        return assertThrows(ResponseStatusException.class, call::run).getReason();
    }

    @Test
    void unchangedIdentitySavesOtherFieldsWithoutPassword() {
        service.updateProfile(5L, form("emre", " Emre@Mail.com ", null));
        service.updateProfile(5L, form("Emre", "emre@mail.com", null));
        assertEquals("Ankara", user.getCity());
        assertEquals("emre", user.getUsername());
        assertEquals("emre@mail.com", user.getEmail());
    }

    @Test
    void identityChangeNeedsTheCurrentPassword() {
        assertEquals("CURRENT_PASSWORD_REQUIRED", reason(() -> service.updateProfile(5L, form("yeni_ad", "emre@mail.com", null))));
        assertEquals("CURRENT_PASSWORD_REQUIRED", reason(() -> service.updateProfile(5L, form("emre", "yeni@mail.com", ""))));
        assertEquals("CURRENT_PASSWORD_WRONG", reason(() -> service.updateProfile(5L, form("yeni_ad", "emre@mail.com", "yanlis"))));
        // Şifre reddedilince hiçbir alan (şehir dahil) değişmez
        assertEquals("emre", user.getUsername());
        assertEquals("emre@mail.com", user.getEmail());
        assertEquals("İstanbul", user.getCity());
        verify(users, never()).save(any());

        service.updateProfile(5L, form("Yeni_Ad", "Yeni@Mail.com", "sifre123"));
        assertEquals("yeni_ad", user.getUsername());
        assertEquals("yeni@mail.com", user.getEmail());
    }

    @Test
    void takenUsernameOrEmailIsAClearConflict() {
        User other = new User();
        ReflectionTestUtils.setField(other, "id", 9L);
        when(users.findByUsername("dolu_ad")).thenReturn(Optional.of(other));
        when(users.findAllByEmailIgnoreCase("dolu@mail.com")).thenReturn(List.of(other));

        assertThrows(AlreadyExistsException.class, () -> service.updateProfile(5L, form("dolu_ad", "emre@mail.com", "sifre123")));
        assertThrows(AlreadyExistsException.class, () -> service.updateProfile(5L, form("emre", "dolu@mail.com", "sifre123")));
        verify(users, never()).save(any());
    }
}
