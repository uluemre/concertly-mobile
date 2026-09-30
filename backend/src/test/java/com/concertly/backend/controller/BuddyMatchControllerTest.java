package com.concertly.backend.controller;

import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.*;
import com.concertly.backend.repository.BuddySwipeRepository;
import com.concertly.backend.repository.EventAttendanceRepository;
import com.concertly.backend.repository.UserRepository;
import com.concertly.backend.service.ModerationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** N-32: Konser Arkadaşı hedefe özel sorgu kullanır ve kişinin kendisiyle eşleşmesine izin vermez. */
class BuddyMatchControllerTest {

    private EventAttendanceRepository attendance;
    private BuddySwipeRepository swipes;
    private UserRepository users;
    private BuddyMatchController controller;

    @BeforeEach
    void setUp() {
        attendance = mock(EventAttendanceRepository.class);
        swipes = mock(BuddySwipeRepository.class);
        users = mock(UserRepository.class);
        ModerationService moderation = mock(ModerationService.class);
        when(moderation.getHiddenUserIds(anyLong())).thenReturn(new HashSet<>());
        controller = new BuddyMatchController(attendance, swipes, users, moderation);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("7:ben@test.local", null, List.of()));
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private static User user(long id) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setUsername("u" + id);
        return u;
    }

    private static EventAttendance going(User u, Event e) {
        EventAttendance ea = new EventAttendance();
        ea.setUser(u);
        ea.setEvent(e);
        ea.setStatus(AttendanceStatus.GOING);
        return ea;
    }

    @Test
    void swipingYourselfOrAMissingUserIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> controller.swipe(Map.of("targetId", 7, "liked", true)));
        when(users.existsById(99L)).thenReturn(false);
        assertThrows(ResourceNotFoundException.class, () -> controller.swipe(Map.of("targetId", 99, "liked", true)));
        assertThrows(IllegalArgumentException.class, () -> controller.swipe(Map.of("liked", true)));
        verify(swipes, never()).save(any());
    }

    @Test
    void likingAnotherUserStillWorks() {
        when(users.existsById(8L)).thenReturn(true);
        when(swipes.findBySwiperIdAndTargetId(7L, 8L)).thenReturn(Optional.empty());
        when(swipes.existsBySwiperIdAndTargetIdAndLikedTrue(8L, 7L)).thenReturn(false);

        assertEquals(false, controller.swipe(Map.of("targetId", 8, "liked", true)).get("matched"));
        verify(swipes).save(any(BuddySwipe.class));
    }

    @Test
    void discoverOnlyLoadsAttendancesOfMyEvents() {
        Event e = new Event();
        ReflectionTestUtils.setField(e, "id", 100L);
        e.setName("Konser");
        e.setEventDate(LocalDateTime.now().plusDays(3));
        User me = user(7), other = user(8);
        when(attendance.findByUserIdAndStatus(7L, AttendanceStatus.GOING)).thenReturn(List.of(going(me, e)));
        when(attendance.findGoingForEvents(eq(Set.of(100L)), any())).thenReturn(List.of(going(me, e), going(other, e)));
        when(users.findById(7L)).thenReturn(Optional.of(me));

        List<Map<String, Object>> cards = controller.discover();

        assertEquals(1, cards.size());
        assertEquals(8L, cards.get(0).get("userId"));
        verify(attendance, never()).findAll();
    }

    @Test
    void matchesUseTargetedQueryAndSkipSelfLikes() {
        BuddySwipe selfLike = new BuddySwipe();
        selfLike.setSwiperId(7L); selfLike.setTargetId(7L); selfLike.setLiked(true);
        BuddySwipe mine = new BuddySwipe();
        mine.setSwiperId(7L); mine.setTargetId(8L); mine.setLiked(true);
        BuddySwipe theirs = new BuddySwipe();
        theirs.setSwiperId(8L); theirs.setTargetId(7L); theirs.setLiked(true);
        when(swipes.findBySwiperId(7L)).thenReturn(List.of(selfLike, mine));
        when(swipes.findByTargetIdAndLikedTrue(7L)).thenReturn(List.of(selfLike, theirs));
        when(users.findById(8L)).thenReturn(Optional.of(user(8)));

        List<Map<String, Object>> matches = controller.getMatches();

        assertEquals(1, matches.size());
        assertEquals(8L, matches.get(0).get("userId"));
        verify(swipes, never()).findAll();
    }
}
