package com.concertly.backend.service;

import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.*;
import com.concertly.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Konser Arkadaşı: yalnız "arkadaş arıyorum" diyenler görünür ve karşılıklıdır; uyum gerçek
 * ortaklıklardan çıkar; eşleşmede karşı tarafa bildirim gider. (N-32 kuralları da korunur.)
 */
class BuddyMatchServiceTest {

    private ConcertBuddyRepository buddies;
    private EventAttendanceRepository attendance;
    private BuddySwipeRepository swipes;
    private UserRepository users;
    private ArtistFollowRepository follows;
    private MessageRepository messages;
    private ModerationService moderation;
    private NotificationService notifications;
    private BuddyMatchService service;

    private final Event concert = event(100L, "Konser");
    private final User me = user(7), other = user(8), third = user(9);

    @BeforeEach
    void setUp() {
        buddies = mock(ConcertBuddyRepository.class);
        attendance = mock(EventAttendanceRepository.class);
        swipes = mock(BuddySwipeRepository.class);
        users = mock(UserRepository.class);
        follows = mock(ArtistFollowRepository.class);
        messages = mock(MessageRepository.class);
        moderation = mock(ModerationService.class);
        notifications = mock(NotificationService.class);
        when(moderation.getHiddenUserIds(anyLong())).thenReturn(new HashSet<>());
        when(users.findById(7L)).thenReturn(Optional.of(me));
        service = new BuddyMatchService(buddies, attendance, swipes, users, follows, messages, moderation, notifications);
    }

    private static Event event(long id, String name) {
        Event e = new Event();
        ReflectionTestUtils.setField(e, "id", id);
        e.setName(name);
        e.setEventDate(LocalDateTime.now().plusDays(3));
        e.setIsApproved(true);
        return e;
    }

    private static User user(long id) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setUsername("u" + id);
        return u;
    }

    private static ConcertBuddy looking(User u, Event e, String message) {
        ConcertBuddy b = new ConcertBuddy();
        b.setUser(u);
        b.setEvent(e);
        b.setMessage(message);
        return b;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> cards(Map<String, Object> discover) {
        return (List<Map<String, Object>>) discover.get("cards");
    }

    // ── Deste ────────────────────────────────────────────────────────────────

    @Test
    void onlyPeopleLookingForABuddyAppearAndOnlyWhenIAmLookingToo() {
        // Ben aramıyorum: deste boş, ama kaç kişinin aradığı görünür (açma teşviki)
        when(buddies.findUpcomingForUser(eq(7L), any())).thenReturn(List.of());
        EventAttendance going = new EventAttendance();
        going.setUser(me); going.setEvent(concert); going.setStatus(AttendanceStatus.GOING);
        when(attendance.findUpcomingGoing(eq(7L), any(), any())).thenReturn(List.of(going));
        when(buddies.findForEvents(Set.of(100L))).thenReturn(List.of(looking(other, concert, "ilk konserim")));

        Map<String, Object> closed = service.discover(7L, null);
        assertTrue(cards(closed).isEmpty());
        @SuppressWarnings("unchecked")
        Map<String, Object> myEvent = ((List<Map<String, Object>>) closed.get("myEvents")).get(0);
        assertEquals(false, myEvent.get("lookingForBuddy"));
        assertEquals(1L, myEvent.get("buddyCount"));

        // Ben de arıyorum: arayan kişi mesajıyla birlikte gelir; sadece "Gidiyorum" diyen gelmez
        when(buddies.findUpcomingForUser(eq(7L), any())).thenReturn(List.of(looking(me, concert, null)));
        when(buddies.findForEvents(Set.of(100L))).thenReturn(List.of(looking(me, concert, null), looking(other, concert, "ilk konserim")));
        List<Map<String, Object>> open = cards(service.discover(7L, null));
        assertEquals(1, open.size());
        assertEquals(8L, open.get(0).get("userId"));
        @SuppressWarnings("unchecked")
        Map<String, Object> shared = ((List<Map<String, Object>>) open.get(0).get("sharedEvents")).get(0);
        assertEquals("ilk konserim", shared.get("message"));
        verify(attendance, never()).findAll();
    }

    @Test
    void peopleWhoLikedMeComeFirstAndSwipedOrBlockedPeopleAreSkipped() {
        when(buddies.findUpcomingForUser(eq(7L), any())).thenReturn(List.of(looking(me, concert, null)));
        User blocked = user(10);
        when(buddies.findForEvents(any())).thenReturn(List.of(
                looking(other, concert, null), looking(third, concert, null), looking(blocked, concert, null), looking(user(11), concert, null)));
        when(moderation.getHiddenUserIds(7L)).thenReturn(new HashSet<>(Set.of(10L)));
        BuddySwipe swiped = new BuddySwipe(); swiped.setSwiperId(7L); swiped.setTargetId(11L);
        when(swipes.findBySwiperId(7L)).thenReturn(List.of(swiped));
        BuddySwipe likesMe = new BuddySwipe(); likesMe.setSwiperId(9L); likesMe.setTargetId(7L); likesMe.setLiked(true);
        when(swipes.findByTargetIdAndLikedTrue(7L)).thenReturn(List.of(likesMe));

        Map<String, Object> d = service.discover(7L, null);
        List<Long> ids = cards(d).stream().map(c -> (Long) c.get("userId")).toList();
        assertEquals(List.of(9L, 8L), ids);
        assertEquals(1L, d.get("likesReceived"));
    }

    @Test
    void privateCandidateShowsHeaderOnlyAndScoresZero() {
        me.setFavoriteGenres("Rock,Pop");
        third.setPrivateAccount(true);
        third.setBio("gizli"); third.setCity("İzmir"); third.setFavoriteGenres("Rock");
        when(buddies.findUpcomingForUser(eq(7L), any())).thenReturn(List.of(looking(me, concert, null)));
        when(buddies.findForEvents(any())).thenReturn(List.of(looking(third, concert, null)));

        Map<String, Object> card = cards(service.discover(7L, null)).get(0);
        assertEquals("", card.get("bio"));
        assertEquals("", card.get("city"));
        assertEquals("", card.get("favoriteGenres"));
        assertEquals(0, card.get("compatibility"));
        verify(follows, never()).findAllByUserId(9L);
    }

    // ── Uyum ─────────────────────────────────────────────────────────────────

    @Test
    void compatibilityComesFromRealOverlap() {
        BuddyMatchService.Profile a = new BuddyMatchService.Profile(
                Map.of(1L, "Duman", 2L, "Sezen Aksu", 3L, "Mor ve Ötesi"), Set.of("rock", "pop"), "istanbul", Set.of(50L, 51L));
        BuddyMatchService.Profile b = new BuddyMatchService.Profile(
                Map.of(1L, "Duman", 3L, "Mor ve Ötesi", 4L, "Tarkan"), Set.of("rock"), "istanbul", Set.of(50L));
        BuddyMatchService.Compatibility c = BuddyMatchService.compatibility(a, b);
        // 2 ortak sanatçı 28 + tür 1/2×30 = 15 + şehir 10 + 1 ortak konser 10 = 63
        assertEquals(63, c.score());
        assertEquals(List.of("Duman", "Mor ve Ötesi"), c.sharedArtists());
        assertEquals(List.of("rock"), c.sharedGenres());
        assertTrue(c.sameCity());
        assertEquals(1, c.pastConcertsTogether());

        assertEquals(0, BuddyMatchService.compatibility(a, BuddyMatchService.Profile.EMPTY).score());
        assertEquals(Set.of("rock", "pop"), BuddyMatchService.genresOf(" Rock, Pop ,"));
    }

    // ── Kaydırma ─────────────────────────────────────────────────────────────

    @Test
    void swipingYourselfOrAMissingUserIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> service.swipe(7L, 7L, true));
        when(users.existsById(99L)).thenReturn(false);
        assertThrows(ResourceNotFoundException.class, () -> service.swipe(7L, 99L, true));
        assertThrows(IllegalArgumentException.class, () -> service.swipe(7L, null, true));
        verify(swipes, never()).save(any());
    }

    @Test
    void likingSomeoneOutsideASharedBuddySearchIsRefused() {
        when(users.existsById(8L)).thenReturn(true);
        when(buddies.findUpcomingForUser(eq(7L), any())).thenReturn(List.of(looking(me, concert, null)));
        when(buddies.findUpcomingForUser(eq(8L), any())).thenReturn(List.of());
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> service.swipe(7L, 8L, true));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        // Geçmek her zaman serbest
        when(swipes.findBySwiperIdAndTargetId(7L, 8L)).thenReturn(Optional.empty());
        assertEquals(false, service.swipe(7L, 8L, false).get("matched"));
    }

    @Test
    void mutualLikeMatchesAndNotifiesTheOtherSide() {
        when(users.existsById(8L)).thenReturn(true);
        when(users.findById(8L)).thenReturn(Optional.of(other));
        when(buddies.findUpcomingForUser(eq(7L), any())).thenReturn(List.of(looking(me, concert, null)));
        when(buddies.findUpcomingForUser(eq(8L), any())).thenReturn(List.of(looking(other, concert, null)));
        when(swipes.findBySwiperIdAndTargetId(7L, 8L)).thenReturn(Optional.empty());
        when(swipes.existsBySwiperIdAndTargetIdAndLikedTrue(8L, 7L)).thenReturn(true);

        Map<String, Object> r = service.swipe(7L, 8L, true);
        assertEquals(true, r.get("matched"));
        @SuppressWarnings("unchecked")
        Map<String, Object> matched = (Map<String, Object>) r.get("matchedUser");
        assertEquals("u8", matched.get("username"));
        verify(notifications).send(8L, 7L, "buddy_match", "buddy", 7L);
    }

    @Test
    void undoRemovesALastSwipeButNotAnEstablishedMatch() {
        BuddySwipe pass = new BuddySwipe(); pass.setSwiperId(7L); pass.setTargetId(8L); pass.setLiked(false);
        when(swipes.findBySwiperIdAndTargetId(7L, 8L)).thenReturn(Optional.of(pass));
        service.undo(7L, 8L);
        verify(swipes).delete(pass);

        BuddySwipe like = new BuddySwipe(); like.setSwiperId(7L); like.setTargetId(9L); like.setLiked(true);
        when(swipes.findBySwiperIdAndTargetId(7L, 9L)).thenReturn(Optional.of(like));
        when(swipes.existsBySwiperIdAndTargetIdAndLikedTrue(9L, 7L)).thenReturn(true);
        assertThrows(ResponseStatusException.class, () -> service.undo(7L, 9L));
        verify(swipes, never()).delete(like);
    }

    // ── Eşleşmeler ───────────────────────────────────────────────────────────

    @Test
    void matchesSkipSelfLikesAndUnmatchWithdrawsMyLike() {
        BuddySwipe selfLike = new BuddySwipe(); selfLike.setSwiperId(7L); selfLike.setTargetId(7L); selfLike.setLiked(true);
        BuddySwipe mine = new BuddySwipe(); mine.setSwiperId(7L); mine.setTargetId(8L); mine.setLiked(true);
        BuddySwipe theirs = new BuddySwipe(); theirs.setSwiperId(8L); theirs.setTargetId(7L); theirs.setLiked(true);
        when(swipes.findBySwiperId(7L)).thenReturn(List.of(selfLike, mine));
        when(swipes.findByTargetIdAndLikedTrue(7L)).thenReturn(List.of(selfLike, theirs));
        when(users.findById(8L)).thenReturn(Optional.of(other));
        when(messages.conversationExists(7L, 8L)).thenReturn(true);

        List<Map<String, Object>> list = service.matches(7L);
        assertEquals(1, list.size());
        assertEquals(8L, list.get(0).get("userId"));
        assertEquals(true, list.get(0).get("hasConversation"));
        verify(swipes, never()).findAll();

        when(swipes.findBySwiperIdAndTargetId(7L, 8L)).thenReturn(Optional.of(mine));
        service.unmatch(7L, 8L);
        assertFalse(mine.isLiked());
        verify(swipes).save(mine);
    }
}
