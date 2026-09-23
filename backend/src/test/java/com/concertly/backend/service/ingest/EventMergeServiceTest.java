package com.concertly.backend.service.ingest;

import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventSource;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Asil kayit (canonical) secimi.
 *
 * Kural Ticketmaster'i korumak icin var: TM kaydi asil kalirsa onun
 * external_id'si events satirinda kalir ve TicketmasterService'in sorgusu
 * bozulmaz — o koda hic dokunmuyoruz.
 */
class EventMergeServiceTest {

    private final EventMergeService service = new EventMergeService(null, null);

    private static Event event(long id, EventSource source) {
        Event e = new Event();
        ReflectionTestUtils.setField(e, "id", id);
        e.setSource(source);
        return e;
    }

    @Test
    void ticketmasterWinsRegardlessOfOrder() {
        Event tm = event(8699, EventSource.TICKETMASTER);
        Event bi = event(9429, EventSource.BILETINIAL);

        assertEquals(tm, service.chooseCanonical(tm, bi));
        assertEquals(tm, service.chooseCanonical(bi, tm));
    }

    /** Ticketmaster yoksa daha eski kayit asil olur: kullanici verisi orada birikmistir. */
    @Test
    void olderEventWinsWhenNeitherIsTicketmaster() {
        Event older = event(100, EventSource.BILETINIAL);
        Event newer = event(900, EventSource.ADMIN);

        assertEquals(older, service.chooseCanonical(older, newer));
        assertEquals(older, service.chooseCanonical(newer, older));
    }

    @Test
    void ticketmasterBeatsOlderNonTicketmaster() {
        Event olderBiletinial = event(100, EventSource.BILETINIAL);
        Event newerTicketmaster = event(900, EventSource.TICKETMASTER);

        assertEquals(newerTicketmaster, service.chooseCanonical(olderBiletinial, newerTicketmaster));
    }
}
