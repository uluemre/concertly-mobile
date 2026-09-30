package com.concertly.backend.service;

import com.concertly.backend.model.Badge;
import com.concertly.backend.model.Notification;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.BadgeRepository;
import com.concertly.backend.repository.PostRepository;
import com.concertly.backend.repository.UserBadgeRepository;
import com.concertly.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** N-38: yeni kazanılan rozet bildirilir; tekrar, yarış ve "Yeni Üye" bildirilmez. */
class BadgeNotificationTest {

    private UserBadgeRepository userBadges;
    private NotificationService notifications;
    private ConcertAttendanceService attendance;
    private PostRepository posts;
    private BadgeService service;

    private static Badge badge(long id, String code) {
        Badge b = new Badge();
        ReflectionTestUtils.setField(b, "id", id);
        b.setCode(code);
        b.setName(code);
        return b;
    }

    @BeforeEach
    void setUp() {
        BadgeRepository badges = mock(BadgeRepository.class);
        userBadges = mock(UserBadgeRepository.class);
        UserRepository users = mock(UserRepository.class);
        notifications = mock(NotificationService.class);
        attendance = mock(ConcertAttendanceService.class);
        posts = mock(PostRepository.class);
        when(users.findById(7L)).thenReturn(Optional.of(new User()));
        when(badges.findByCode("yeni_uye")).thenReturn(Optional.of(badge(1, "yeni_uye")));
        when(badges.findByCode("ilk_konser")).thenReturn(Optional.of(badge(2, "ilk_konser")));
        when(badges.findByCode("konser_kurdu")).thenReturn(Optional.of(badge(3, "konser_kurdu")));
        when(badges.findByCode("ilk_paylasim")).thenReturn(Optional.of(badge(5, "ilk_paylasim")));
        service = new BadgeService(badges, userBadges, users, attendance, posts, notifications);
    }

    @Test
    void newlyEarnedBadgesAreEachNotifiedButNewMemberIsSilent() {
        when(attendance.attendedCount(7L)).thenReturn(5L);
        when(userBadges.insertIfAbsent(eq(7L), anyLong(), any())).thenReturn(1);

        service.checkAndAwardBadges(7L);

        verify(notifications).sendSystem(7L, "badge", "badge", 2L, "ilk_konser");
        verify(notifications).sendSystem(7L, "badge", "badge", 3L, "konser_kurdu");
        verify(notifications, never()).sendSystem(anyLong(), anyString(), anyString(), eq(1L), anyString());
        verify(notifications, times(2)).sendSystem(anyLong(), anyString(), anyString(), anyLong(), anyString());
    }

    @Test
    void alreadyEarnedBadgesAreNotNotifiedAgain() {
        when(attendance.attendedCount(7L)).thenReturn(1L);
        when(userBadges.existsByUserIdAndBadgeCode(eq(7L), anyString())).thenReturn(true);

        service.checkAndAwardBadges(7L);

        verify(userBadges, never()).insertIfAbsent(anyLong(), anyLong(), any());
        verifyNoInteractions(notifications);
    }

    @Test
    void concurrentInsertLosesSilentlyWithoutNotification() {
        when(posts.countByUserId(7L)).thenReturn(1L);
        // Başka bir istek rozeti bir an önce ekledi: ekleme 0 satır döner
        when(userBadges.insertIfAbsent(eq(7L), anyLong(), any())).thenReturn(0);

        assertDoesNotThrow(() -> service.checkAndAwardBadges(7L));
        verifyNoInteractions(notifications);
    }

    @Test
    void pushTextIsLocalisedByBadgeCode() {
        PushMessageFactory factory = new PushMessageFactory();
        Notification n = new Notification();
        n.setType("badge");
        n.setMessage("konser_kurdu");

        String[] tr = factory.build(n, "tr");
        String[] en = factory.build(n, "en");

        assertEquals("Yeni rozet! 🏅", tr[0]);
        assertEquals("\"Konser Kurdu\" rozetini kazandın!", tr[1]);
        assertEquals("New badge! 🏅", en[0]);
        assertEquals("You earned the \"Concert Buff\" badge.", en[1]);
    }
}
