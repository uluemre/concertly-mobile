package com.concertly.backend.service.ingest;

import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventSource;
import com.concertly.backend.model.EventSourceLink;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.EventSourceLinkRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * event_sources tablosunun bakimi.
 *
 * Backfill BILEREK yalnizca EKLER: hicbir etkinligi silmez, gizlemez ya da
 * alanlarini degistirmez. Tekrar calistirilabilir; var olan kaynak satiri
 * atlanir.
 */
@Service
public class EventSourceLinkService {

    private static final Logger log = LoggerFactory.getLogger(EventSourceLinkService.class);

    private final EventRepository eventRepository;
    private final EventSourceLinkRepository linkRepository;

    public EventSourceLinkService(EventRepository eventRepository,
            EventSourceLinkRepository linkRepository) {
        this.eventRepository = eventRepository;
        this.linkRepository = linkRepository;
    }

    public record BackfillResult(int scanned, int created, int skipped) {}

    /**
     * Kaynak satiri olmayan her etkinlik icin mevcut alanlarindan bir satir uretir.
     *
     * Etkinlik sayisi degismez; yalnizca event_sources buyur.
     */
    @Transactional
    public BackfillResult backfill() {
        List<Event> events = eventRepository.findAll();
        int created = 0, skipped = 0;

        for (Event event : events) {
            String externalId = event.getExternalId();
            if (externalId == null || externalId.isBlank()) { skipped++; continue; }

            EventSource source = event.getSource();
            if (linkRepository.existsBySourceAndExternalId(source, externalId)) { skipped++; continue; }

            EventSourceLink link = new EventSourceLink();
            link.setEvent(event);
            link.setSource(source);
            link.setExternalId(externalId);
            link.setTicketUrl(event.getTicketUrl());
            link.setSourceUrl(event.getSourceUrl());
            // Mevcut tek kaynak, Event uzerindeki ayna alanlarin sahibidir.
            link.setIsPrimary(true);
            linkRepository.save(link);
            created++;
        }
        log.info("event_sources backfill: {} tarandi, {} eklendi, {} atlandi",
                events.size(), created, skipped);
        return new BackfillResult(events.size(), created, skipped);
    }

    /** Ice aktaricilarin kimlik sorgusu. */
    public Optional<EventSourceLink> find(EventSource source, String externalId) {
        return linkRepository.findBySourceAndExternalId(source, externalId);
    }

    /**
     * Kaynak satirini olusturur ya da tazeler.
     *
     * Ice aktarim her kosuda cagirir; last_seen_at guncellenir, boylece bir
     * kaynakta artik gorunmeyen kayitlar ileride ayirt edilebilir.
     */
    @Transactional
    public EventSourceLink upsert(Event event, EventSource source, String externalId,
            String ticketUrl, String sourceUrl, boolean primary) {
        EventSourceLink link = linkRepository.findBySourceAndExternalId(source, externalId)
                .orElseGet(EventSourceLink::new);
        if (link.getId() == null) {
            link.setSource(source);
            link.setExternalId(externalId);
            link.setFirstSeenAt(LocalDateTime.now());
            link.setIsPrimary(primary);
        }
        link.setEvent(event);
        link.setTicketUrl(ticketUrl);
        link.setSourceUrl(sourceUrl);
        link.setLastSeenAt(LocalDateTime.now());
        return linkRepository.save(link);
    }

    public List<EventSourceLink> forEvent(Long eventId) {
        return linkRepository.findByEventId(eventId);
    }
}
