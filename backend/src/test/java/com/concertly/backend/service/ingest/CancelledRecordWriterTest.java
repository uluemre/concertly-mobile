package com.concertly.backend.service.ingest;

import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventSource;
import com.concertly.backend.model.EventSourceLink;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.VenueRepository;
import com.concertly.backend.service.EventCancellationService;
import com.concertly.backend.service.TicketmasterService;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Kaynak bir seansi iptal bildirdiginde: var olan kayit iptal edilir, yeni kayit acilmaz. */
class CancelledRecordWriterTest {

    private static RawConcertData cancelledRaw() {
        return new RawConcertData("BUBILET", "hadise@seans3", "Hadise", "Hadise",
                LocalDateTime.of(2026, 11, 3, 20, 0), "Oran", null, "Ankara",
                null, null, "https://x", null, true);
    }

    @Test
    void cancelledSourceRecordCancelsTheExistingEventAndCreatesNothing() {
        EventRepository events = mock(EventRepository.class);
        EventSourceLinkService links = mock(EventSourceLinkService.class);
        EventCancellationService cancellation = mock(EventCancellationService.class);
        Event existing = new Event();
        ReflectionTestUtils.setField(existing, "id", 5L);
        EventSourceLink link = new EventSourceLink();
        link.setEvent(existing);
        when(links.find(eq(EventSource.BUBILET), anyString())).thenReturn(Optional.of(link));

        BiletinialRecordWriter writer = new BiletinialRecordWriter(events, mock(ArtistRepository.class),
                mock(VenueRepository.class), links);
        ReflectionTestUtils.setField(writer, "cancellation", cancellation);

        assertFalse(writer.upsert(cancelledRaw()));
        verify(cancellation).cancel(existing);
        verify(events, never()).save(any());
    }

    @Test
    void unknownCancelledRecordIsIgnored() {
        EventRepository events = mock(EventRepository.class);
        EventSourceLinkService links = mock(EventSourceLinkService.class);
        EventCancellationService cancellation = mock(EventCancellationService.class);
        when(links.find(any(), anyString())).thenReturn(Optional.empty());
        when(events.findByExternalId(anyString())).thenReturn(Optional.empty());

        BiletinialRecordWriter writer = new BiletinialRecordWriter(events, mock(ArtistRepository.class),
                mock(VenueRepository.class), links);
        ReflectionTestUtils.setField(writer, "cancellation", cancellation);

        assertFalse(writer.upsert(cancelledRaw()));
        verifyNoInteractions(cancellation);
        verify(events, never()).save(any());
    }

    @Test
    void ticketmasterStatusCodeIsRead() {
        assertEquals("cancelled", TicketmasterService.statusCode(
                Map.<String, Object>of("dates", Map.of("status", Map.of("code", "cancelled")))));
        assertNull(TicketmasterService.statusCode(Map.<String, Object>of()));
    }
}
