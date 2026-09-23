package com.concertly.backend.service.ingest;

import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventSource;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.EventSourceLinkRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Birlestirme altyapisinin uctan uca dogrulamasi.
 *
 * GERCEK mukerrer ciftlere DOKUNMAZ: kendi gecici kayitlarini olusturur,
 * birlestirir, geri alir ve temizler.
 *
 * Calistirma:
 *   ./mvnw test -Dtest=EventMergeIntegrationTest -Dsource.merge=true -DfailIfNoTests=false
 */
@SpringBootTest
@EnabledIfSystemProperty(named = "source.merge", matches = "true")
class EventMergeIntegrationTest {

    @Autowired private EventMergeService mergeService;
    @Autowired private EventSourceLinkService linkService;
    @Autowired private EventRepository eventRepository;
    @Autowired private EventSourceLinkRepository linkRepository;

    private Event createTemp(String externalId, EventSource source) {
        Event e = new Event();
        e.setName("MERGE TEST " + externalId);
        e.setEventDate(LocalDateTime.now().plusDays(400));
        e.setExternalId(externalId);
        e.setSource(source);
        e.setIsApproved(true);
        e.setTicketUrl("https://ornek/" + externalId);
        Event saved = eventRepository.save(e);
        linkService.upsert(saved, source, externalId, saved.getTicketUrl(), null, true);
        return saved;
    }

    @Test
    void mergesAndUnmergesWithoutDeletingAnything() {
        long eventsBefore = eventRepository.count();
        String tmId = "mergetest-tm-" + System.currentTimeMillis();
        String biId = "mergetest-bi-" + System.currentTimeMillis();

        Event tm = createTemp(tmId, EventSource.TICKETMASTER);
        Event bi = createTemp(biId, EventSource.BILETINIAL);
        try {
            // Biletinial once verilse bile asil kayit Ticketmaster olmali.
            EventMergeService.MergeResult result = mergeService.merge(bi.getId(), tm.getId());

            assertEquals(tm.getId(), result.canonicalEventId(), "Ticketmaster asil kayit olmali");
            assertEquals(bi.getId(), result.mergedEventId());
            assertEquals(1, result.movedSourceLinks());

            Event mergedRow = eventRepository.findById(bi.getId()).orElseThrow();
            assertNotNull(mergedRow, "Birlestirilen kayit SILINMEMELI");
            assertFalse(mergedRow.getIsApproved(), "Birlestirilen kayit gizlenmeli");
            assertEquals(tm.getId(), mergedRow.getMergedIntoEventId());

            // Iki kaynak da asil kayitta toplanmali.
            assertEquals(2, linkRepository.findByEventId(tm.getId()).size(),
                    "Asil kayit iki kaynak satirina sahip olmali");
            assertTrue(linkRepository.findByEventId(bi.getId()).isEmpty());

            // Kimlik korundugu icin sync mukerrer yaratmaz: arama asil kaydi bulmali.
            assertEquals(tm.getId(),
                    linkService.find(EventSource.BILETINIAL, biId).orElseThrow().getEvent().getId());

            // Geri alma
            mergeService.unmerge(bi.getId());
            Event restored = eventRepository.findById(bi.getId()).orElseThrow();
            assertNull(restored.getMergedIntoEventId());
            assertTrue(restored.getIsApproved());
            assertEquals(1, linkRepository.findByEventId(bi.getId()).size());

            assertEquals(eventsBefore + 2, eventRepository.count(), "Hicbir kayit silinmemeli");
        } finally {
            linkRepository.findByEventId(tm.getId()).forEach(linkRepository::delete);
            linkRepository.findByEventId(bi.getId()).forEach(linkRepository::delete);
            eventRepository.deleteById(bi.getId());
            eventRepository.deleteById(tm.getId());
        }
        assertEquals(eventsBefore, eventRepository.count(), "Test kendi kayitlarini temizlemeli");
    }
}
