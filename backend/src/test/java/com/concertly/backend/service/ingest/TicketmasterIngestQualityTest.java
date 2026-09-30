package com.concertly.backend.service.ingest;

import com.concertly.backend.config.LaunchCityConfig;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventSource;
import com.concertly.backend.model.Venue;
import com.concertly.backend.repository.*;
import com.concertly.backend.service.DeezerService;
import com.concertly.backend.service.NotificationService;
import com.concertly.backend.service.SpotifyService;
import com.concertly.backend.service.TicketmasterService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** N-34: Ticketmaster aktarımında tarih penceresi, zorunlu mekân ve tür çıkarımı. */
class TicketmasterIngestQualityTest {

    private EventRepository events;
    private VenueRepository venues;
    private EventSourceLinkService sourceLinks;
    private TicketmasterService service;

    @BeforeEach
    void setUp() {
        events = mock(EventRepository.class);
        venues = mock(VenueRepository.class);
        sourceLinks = mock(EventSourceLinkService.class);
        ArtistRepository artists = mock(ArtistRepository.class);
        ArtistFollowRepository follows = mock(ArtistFollowRepository.class);
        service = new TicketmasterService(events, artists, venues, mock(SpotifyService.class),
                mock(DeezerService.class), follows, mock(NotificationService.class),
                mock(LaunchCityConfig.class), sourceLinks);
        when(artists.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(venues.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(venues.findByExternalId(any())).thenReturn(Optional.empty());
        when(events.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(follows.findAllByArtistId(any())).thenReturn(List.of());
        when(sourceLinks.find(eq(EventSource.TICKETMASTER), any())).thenReturn(Optional.empty());
        when(events.findByExternalId(any())).thenReturn(Optional.empty());
    }

    private static Map<String, Object> tmEvent(String id, LocalDate date, List<Map<String, Object>> venueList,
                                               Map<String, Object> classification) {
        Map<String, Object> emb = new HashMap<>();
        emb.put("attractions", List.of(Map.of("id", "ATT-" + id, "name", "Sanatçı " + id)));
        if (venueList != null) emb.put("venues", venueList);
        Map<String, Object> e = new HashMap<>();
        e.put("id", id);
        e.put("name", "Sanatçı " + id);
        e.put("url", "https://www.biletix.com/" + id);
        e.put("dates", Map.of("start", Map.of("localDate", date.toString(), "localTime", "21:00:00")));
        e.put("classifications", List.of(classification));
        e.put("_embedded", emb);
        return e;
    }

    private static final List<Map<String, Object>> VENUE =
            List.of(Map.of("id", "VEN-1", "name", "Test Sahne", "city", Map.of("name", "Istanbul")));
    private static final Map<String, Object> POP =
            Map.of("segment", Map.of("name", "Music"), "genre", Map.of("name", "Pop"));

    private void sync(Map<String, Object> tmEvent) {
        ReflectionTestUtils.invokeMethod(service, "processEvents", List.of(tmEvent), "Istanbul");
    }

    private Event lastSaved() {
        ArgumentCaptor<Event> saved = ArgumentCaptor.forClass(Event.class);
        verify(events, atLeastOnce()).save(saved.capture());
        return saved.getValue();
    }

    @Test
    void normalConcertIsStillImported() {
        sync(tmEvent("TM-OK", LocalDate.now().plusDays(10), VENUE, POP));
        Event e = lastSaved();
        assertEquals("Test Sahne", e.getVenue().getName());
        assertEquals("Pop", e.getGenre());
    }

    @Test
    void farFutureDateIsSkipped() {
        sync(tmEvent("TM-2034", LocalDate.now().plusYears(8), VENUE, POP));
        verify(events, never()).save(any());
    }

    @Test
    void newEventWithoutVenueIsSkippedAndNoPlaceholderVenueIsCreated() {
        sync(tmEvent("TM-NOVEN", LocalDate.now().plusDays(10), null, POP));
        sync(tmEvent("TM-NONAME", LocalDate.now().plusDays(10),
                List.of(Map.of("id", "VEN-X", "city", Map.of("name", "Izmir"))), POP));
        verify(events, never()).save(any());
        verify(venues, never()).save(any());
    }

    @Test
    void existingEventKeepsItsVenueWhenTheFeedDropsIt() {
        Venue known = new Venue();
        known.setName("Bilinen Salon");
        Event existing = new Event();
        existing.setExternalId("TM-OLD");
        existing.setVenue(known);
        when(events.findByExternalId("TM-OLD")).thenReturn(Optional.of(existing));

        sync(tmEvent("TM-OLD", LocalDate.now().plusDays(10), null, POP));

        assertSame(known, lastSaved().getVenue());
    }

    @Test
    void undefinedSubGenreFallsBackToGenre() {
        sync(tmEvent("TM-GEN", LocalDate.now().plusDays(10), VENUE, Map.of(
                "segment", Map.of("name", "Music"),
                "genre", Map.of("name", "Rock"),
                "subGenre", Map.of("name", "Undefined"))));
        assertEquals("Rock", lastSaved().getGenre());
    }

    @Test
    void validatorSharesTheSameHorizon() {
        assertTrue(RawConcertValidator.isBeyondHorizon(LocalDateTime.now().plusYears(4)));
        assertFalse(RawConcertValidator.isBeyondHorizon(LocalDateTime.now().plusYears(2)));
        assertFalse(RawConcertValidator.isBeyondHorizon(null));
    }
}
