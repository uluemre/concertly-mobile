package com.concertly.backend.service.ingest;

import com.concertly.backend.dto.response.DuplicateCandidateResponse;
import com.concertly.backend.model.Artist;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventSource;
import com.concertly.backend.model.Venue;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Admin inceleme ciktisinin eksiksizligi.
 *
 * Karari veren kisi iki satiri yan yana gorup hukmedecek; alanlardan biri
 * kaybolursa (ozellikle koordinat ve kaynak) inceleme anlamsizlasir.
 */
class DuplicateCandidateResponseTest {

    private static Event event(long id, EventSource source, String externalId) {
        Artist artist = new Artist();
        artist.setName("Evgeny Grinko");
        Venue venue = new Venue();
        venue.setName("HABİTAT Hilltown");
        venue.setCity("İstanbul");
        venue.setLatitude(41.0);
        venue.setLongitude(29.0);

        Event event = new Event();
        ReflectionTestUtils.setField(event, "id", id);
        event.setName("Evgeny Grinko Konseri");
        event.setArtist(artist);
        event.setVenue(venue);
        event.setEventDate(LocalDateTime.parse("2026-10-03T21:00"));
        event.setSource(source);
        event.setExternalId(externalId);
        event.setTicketUrl("https://ornek/bilet");
        return event;
    }

    @Test
    void mapsEveryFieldNeededForReview() {
        DuplicateCandidateResponse.EventSide side =
                DuplicateCandidateResponse.EventSide.from(
                        event(9441, EventSource.BILETINIAL, "biletinial:evgeny-grinko@2026-10-03T21:00"));

        assertEquals(9441L, side.eventId());
        assertEquals("BILETINIAL", side.source());
        assertEquals("biletinial:evgeny-grinko@2026-10-03T21:00", side.externalId());
        assertEquals("Evgeny Grinko Konseri", side.concertName());
        assertEquals("Evgeny Grinko", side.artistName());
        assertEquals(LocalDateTime.parse("2026-10-03T21:00"), side.eventDate());
        assertEquals("HABİTAT Hilltown", side.venueName());
        assertEquals("İstanbul", side.city());
        assertEquals(41.0, side.latitude());
        assertEquals(29.0, side.longitude());
        assertEquals("https://ornek/bilet", side.ticketUrl());
    }

    /** Eksik iliski cokmeye yol acmamali: inceleme listesi yine acilabilmeli. */
    @Test
    void toleratesMissingArtistAndVenue() {
        Event bare = new Event();
        ReflectionTestUtils.setField(bare, "id", 7L);

        DuplicateCandidateResponse.EventSide side = DuplicateCandidateResponse.EventSide.from(bare);

        assertEquals(7L, side.eventId());
        assertNull(side.artistName());
        assertNull(side.venueName());
        assertNull(side.city());
        assertNull(side.latitude());
    }

    @Test
    void nullEventMapsToNullSide() {
        assertNull(DuplicateCandidateResponse.EventSide.from(null));
    }

    /** Eski Ticketmaster kayitlarinda source bos olabilir; alan null gecmeli, patlamamali. */
    @Test
    void handlesEventWithoutSource() {
        Event event = event(7323, null, "ZaHyzZyMZk417rZZv");
        DuplicateCandidateResponse.EventSide side = DuplicateCandidateResponse.EventSide.from(event);

        assertEquals("ADMIN", side.source(), "getSource() null yerine varsayilani doner");
        assertEquals("ZaHyzZyMZk417rZZv", side.externalId());
    }
}
