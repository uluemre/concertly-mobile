package com.concertly.backend.service;

import com.concertly.backend.model.*;
import com.concertly.backend.repository.ArtistFollowRepository;
import com.concertly.backend.repository.EventRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Yeni konser bildirimi: tüm kaynaklar, kopya ve geçmiş/gizli kayıt koruması. */
class NewConcertNotifierTest {

    private final EventRepository events = mock(EventRepository.class);
    private final ArtistFollowRepository follows = mock(ArtistFollowRepository.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final NewConcertNotifier notifier = new NewConcertNotifier(events, follows, notifications);

    private Event event(LocalDateTime when, String delisted) {
        Artist artist = new Artist();
        ReflectionTestUtils.setField(artist, "id", 7L);
        artist.setName("Mirkelam");
        Venue venue = new Venue();
        venue.setCity("İstanbul");
        Event e = new Event();
        ReflectionTestUtils.setField(e, "id", 100L);
        e.setName("Mirkelam");
        e.setArtist(artist);
        e.setVenue(venue);
        e.setEventDate(when);
        e.setIsApproved(delisted == null);
        e.setDelistedReason(delisted);
        e.setSource(EventSource.ZORLU_PSM);
        return e;
    }

    private void followers(long... userIds) {
        List<ArtistFollow> list = new java.util.ArrayList<>();
        for (long id : userIds) {
            User u = new User();
            ReflectionTestUtils.setField(u, "id", id);
            ArtistFollow f = new ArtistFollow();
            f.setUser(u);
            list.add(f);
        }
        when(follows.findAllByArtistId(7L)).thenReturn(list);
    }

    @Test
    void followersOfANewConcertAreNotified() {
        followers(1, 2);
        notifier.notifyFollowers(event(LocalDateTime.now().plusDays(20), null));
        verify(notifications).sendSystem(eq(1L), eq("new_event"), eq("event"), eq(100L), contains("Mirkelam"));
        verify(notifications).sendSystem(eq(2L), eq("new_event"), eq("event"), eq(100L), contains("(İstanbul)"));
    }

    @Test
    void copyOfAConcertAlreadyKnownFromAnotherSiteIsNotNotifiedAgain() {
        followers(1);
        when(events.existsByArtistIdAndIdNotAndEventDateBetween(eq(7L), eq(100L), any(), any())).thenReturn(true);
        notifier.notifyFollowers(event(LocalDateTime.now().plusDays(20), null));
        verifyNoInteractions(notifications);
    }

    @Test
    void pastHiddenOrCancelledConcertsAreNotNotified() {
        followers(1);
        notifier.notifyFollowers(event(LocalDateTime.now().minusDays(1), null));
        notifier.notifyFollowers(event(LocalDateTime.now().plusDays(5), "NOT_MUSIC"));
        notifier.notifyFollowers(event(LocalDateTime.now().plusDays(5), "CANCELLED"));
        verifyNoInteractions(notifications);
    }
}
