package com.concertly.backend.service.ingest;

import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.EventSourceLinkRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Backfill dogrulamasi: yalnizca EKLER.
 *
 * Calistirma:
 *   ./mvnw test -Dtest=EventSourceBackfillIntegrationTest -Dsource.backfill=true -DfailIfNoTests=false
 */
@SpringBootTest
@EnabledIfSystemProperty(named = "source.backfill", matches = "true")
class EventSourceBackfillIntegrationTest {

    @Autowired private EventSourceLinkService service;
    @Autowired private EventRepository eventRepository;
    @Autowired private EventSourceLinkRepository linkRepository;

    @Test
    void backfillAddsLinksWithoutTouchingEvents() {
        long eventsBefore = eventRepository.count();
        List<Long> idsBefore = eventRepository.findAll().stream().map(e -> e.getId()).sorted().toList();
        long approvedBefore = eventRepository.findAll().stream()
                .filter(e -> Boolean.TRUE.equals(e.getIsApproved())).count();

        EventSourceLinkService.BackfillResult first = service.backfill();
        long linksAfterFirst = linkRepository.count();

        // Ikinci kosu hicbir sey eklememeli (tekrar calistirilabilir olmali).
        EventSourceLinkService.BackfillResult second = service.backfill();
        long linksAfterSecond = linkRepository.count();

        long eventsAfter = eventRepository.count();
        List<Long> idsAfter = eventRepository.findAll().stream().map(e -> e.getId()).sorted().toList();
        long approvedAfter = eventRepository.findAll().stream()
                .filter(e -> Boolean.TRUE.equals(e.getIsApproved())).count();

        System.out.println();
        System.out.println("backfill 1: " + first.created() + " eklendi, " + first.skipped() + " atlandi");
        System.out.println("backfill 2: " + second.created() + " eklendi, " + second.skipped() + " atlandi");
        System.out.println("event_sources: " + linksAfterFirst + " -> " + linksAfterSecond);
        System.out.println("events: " + eventsBefore + " -> " + eventsAfter);

        assertEquals(eventsBefore, eventsAfter, "Etkinlik sayisi degismemeli");
        assertEquals(idsBefore, idsAfter, "Etkinlik kimlikleri degismemeli");
        assertEquals(approvedBefore, approvedAfter, "Hicbir etkinlik gizlenmemeli");
        assertEquals(0, second.created(), "Ikinci backfill yeni satir eklememeli");
        assertEquals(linksAfterFirst, linksAfterSecond, "event_sources sayisi sabit kalmali");
        assertTrue(linksAfterFirst > 0, "En az bir kaynak satiri olusmali");

        // Her etkinligin kaynak satiri, kendi external_id'siyle eslesmeli.
        eventRepository.findAll().stream()
                .filter(e -> e.getExternalId() != null && !e.getExternalId().isBlank())
                .limit(50)
                .forEach(e -> assertFalse(linkRepository.findByEventId(e.getId()).isEmpty(),
                        "Etkinlik #" + e.getId() + " icin kaynak satiri yok"));
    }
}
