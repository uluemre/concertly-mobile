package com.concertly.backend.service.ingest;

import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventSource;
import com.concertly.backend.model.EventSourceLink;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.EventSourceLinkRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * Iki etkinligi tek konser altinda birlestirme altyapisi.
 *
 * ONEMLI: bu servis kendiliginden HICBIR SEY birlestirmez. Yalnizca admin
 * onayiyla, cift cift cagrilir.
 *
 * Kurallar:
 *  - Birlestirilen kayit SILINMEZ: is_approved=false + merged_into_event_id.
 *  - Kaynak satirlari asil kayda TASINIR, silinmez. Ice aktarici kimligi
 *    event_sources uzerinden bulduğu icin birlestirme kalici olur; ertesi
 *    geceki sync mukerreri yeniden yaratmaz.
 *  - Ciftte Ticketmaster varsa asil kayit her zaman Ticketmaster olur; boylece
 *    TicketmasterService'in events.external_id uzerinden calisan sorgusu
 *    bozulmaz ve o koda hic dokunulmaz.
 */
@Service
public class EventMergeService {

    private static final Logger log = LoggerFactory.getLogger(EventMergeService.class);

    private final EventRepository eventRepository;
    private final EventSourceLinkRepository linkRepository;

    public EventMergeService(EventRepository eventRepository,
            EventSourceLinkRepository linkRepository) {
        this.eventRepository = eventRepository;
        this.linkRepository = linkRepository;
    }

    public record MergeResult(Long canonicalEventId, Long mergedEventId, int movedSourceLinks) {}

    /**
     * Asil kaydi belirler: Ticketmaster varsa o, yoksa daha eski (kucuk id) kayit.
     * Daha eski kayit, kullanici verisinin birikmis olma ihtimali yuksek olandir.
     */
    public Event chooseCanonical(Event a, Event b) {
        boolean aTm = a.getSource() == EventSource.TICKETMASTER;
        boolean bTm = b.getSource() == EventSource.TICKETMASTER;
        if (aTm && !bTm) return a;
        if (bTm && !aTm) return b;
        return a.getId() <= b.getId() ? a : b;
    }

    /**
     * Iki etkinligi birlestirir.
     *
     * @param eventIdA cift'in bir tarafi
     * @param eventIdB diger tarafi
     */
    @Transactional
    public MergeResult merge(Long eventIdA, Long eventIdB) {
        if (eventIdA == null || eventIdB == null || eventIdA.equals(eventIdB)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Iki farkli etkinlik kimligi gerekli.");
        }
        Event a = load(eventIdA);
        Event b = load(eventIdB);

        if (a.getMergedIntoEventId() != null || b.getMergedIntoEventId() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Kayitlardan biri zaten birlestirilmis.");
        }

        Event canonical = chooseCanonical(a, b);
        Event merged = canonical == a ? b : a;

        // Kaynak satirlarini asil kayda tasi: kimlik kaybolmaz, sync tekrar yaratmaz.
        List<EventSourceLink> links = linkRepository.findByEventId(merged.getId());
        for (EventSourceLink link : links) {
            link.setEvent(canonical);
            // Ayna alanlarin sahibi asil kaydin kendi kaynagi olmaya devam eder.
            link.setIsPrimary(false);
            linkRepository.save(link);
        }

        merged.setIsApproved(false);
        merged.setMergedIntoEventId(canonical.getId());
        eventRepository.save(merged);

        log.info("Etkinlik birlestirildi: #{} -> #{} ({} kaynak satiri tasindi)",
                merged.getId(), canonical.getId(), links.size());
        return new MergeResult(canonical.getId(), merged.getId(), links.size());
    }

    /** Birlestirmeyi geri alir: kayit tekrar yayina girer, kaynak satirlari geri doner. */
    @Transactional
    public MergeResult unmerge(Long mergedEventId) {
        Event merged = load(mergedEventId);
        Long canonicalId = merged.getMergedIntoEventId();
        if (canonicalId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bu kayit birlestirilmemis.");
        }
        int moved = 0;
        for (EventSourceLink link : linkRepository.findByEventId(canonicalId)) {
            if (link.getSource() == merged.getSource()
                    && link.getExternalId() != null
                    && link.getExternalId().equals(merged.getExternalId())) {
                link.setEvent(merged);
                link.setIsPrimary(true);
                linkRepository.save(link);
                moved++;
            }
        }
        merged.setMergedIntoEventId(null);
        merged.setIsApproved(true);
        eventRepository.save(merged);
        return new MergeResult(canonicalId, mergedEventId, moved);
    }

    private Event load(Long id) {
        return eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Etkinlik bulunamadi: " + id));
    }
}
