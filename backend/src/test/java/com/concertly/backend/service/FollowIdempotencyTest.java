package com.concertly.backend.service;

import com.concertly.backend.model.Follow;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.FollowRepository;
import com.concertly.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** N-27: tekrar takip / tekrar takipten çıkma hata vermez, ikinci bildirim gitmez. */
class FollowIdempotencyTest {

    private FollowRepository follows;
    private NotificationService notifications;
    private FollowService service;

    private static User user(long id) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        return u;
    }

    @BeforeEach
    void setUp() {
        follows = mock(FollowRepository.class);
        UserRepository users = mock(UserRepository.class);
        notifications = mock(NotificationService.class);
        service = new FollowService(follows, users, notifications, mock(ModerationService.class));
        when(users.findById(1L)).thenReturn(Optional.of(user(1)));
        when(users.findById(2L)).thenReturn(Optional.of(user(2)));
    }

    @Test
    void followingTwiceIsANoOpTheSecondTime() {
        when(follows.findByFollowerIdAndFollowingId(1L, 2L)).thenReturn(Optional.empty());
        service.follow(1L, 2L);
        when(follows.findByFollowerIdAndFollowingId(1L, 2L)).thenReturn(Optional.of(new Follow()));
        assertDoesNotThrow(() -> service.follow(1L, 2L));

        verify(follows, times(1)).save(any(Follow.class));
        verify(notifications, times(1)).send(eq(2L), eq(1L), eq("follow"), any(), any());
    }

    @Test
    void unfollowingWhenNotFollowingIsANoOp() {
        Follow existing = new Follow();
        when(follows.findByFollowerIdAndFollowingId(1L, 2L)).thenReturn(Optional.of(existing));
        service.unfollow(1L, 2L);
        when(follows.findByFollowerIdAndFollowingId(1L, 2L)).thenReturn(Optional.empty());
        assertDoesNotThrow(() -> service.unfollow(1L, 2L));

        verify(follows, times(1)).delete(existing);
    }

    @Test
    void selfFollowIsStillRejected() {
        assertThrows(IllegalArgumentException.class, () -> service.follow(1L, 1L));
    }
}
