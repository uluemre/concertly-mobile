package com.concertly.backend.service;

import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventClaim;
import com.concertly.backend.model.Organizer;
import com.concertly.backend.repository.EventClaimRepository;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.OrganizerRepository;
import com.concertly.backend.repository.SearchText;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Etkinlik sahiplenme: bilet sitelerinden gelen, organizatörü olmayan bir etkinliği organizatör
 * "bu benim" diye ister; admin onaylarsa etkinlik organizatörün paneline geçer (düzenleme,
 * iptal, duyuru, istatistik) ve doğrulanmış rozeti alır. Aynı etkinliğe gelen diğer bekleyen
 * talepler onayla birlikte reddedilir.
 */
@Service
public class EventClaimService {

    private static final String DATE = "to_char(%s, 'YYYY-MM-DD\"T\"HH24:MI:SS')";

    private final OrganizerService organizerService;
    private final OrganizerRepository organizerRepository;
    private final EventRepository eventRepository;
    private final EventClaimRepository claimRepository;
    private final NotificationService notificationService;
    private final JdbcTemplate jdbc;

    public EventClaimService(OrganizerService organizerService,
                             OrganizerRepository organizerRepository,
                             EventRepository eventRepository,
                             EventClaimRepository claimRepository,
                             NotificationService notificationService,
                             JdbcTemplate jdbc) {
        this.organizerService = organizerService;
        this.organizerRepository = organizerRepository;
        this.eventRepository = eventRepository;
        this.claimRepository = claimRepository;
        this.notificationService = notificationService;
        this.jdbc = jdbc;
    }

    // ── Organizatör ──────────────────────────────────────────────────────────

    /** Sahiplenilebilir etkinlikler: yaklaşan, listelenen, organizatörü olmayan; ad/sanatçı/mekâna göre. */
    public List<Map<String, Object>> claimable(Long userId, String q) {
        Organizer org = organizerService.requireOrganizer(userId);
        if (q == null || q.trim().length() < 2) return List.of();
        String fold = "lower(translate(coalesce(%s, ''), '" + SearchText.FOLD_FROM + "', '" + SearchText.FOLD_TO + "'))";
        String p = SearchText.containsPattern(q.trim());
        return jdbc.queryForList("""
                SELECT e.id, e.name, %s AS "eventDate", e.image_url AS "imageUrl", e.source,
                       v.name AS "venueName", v.city AS "venueCity", a.name AS "artistName",
                       EXISTS (SELECT 1 FROM event_claims c WHERE c.event_id = e.id AND c.organizer_id = ? AND c.status = 'PENDING') AS "claimPending"
                FROM events e LEFT JOIN venues v ON v.id = e.venue_id LEFT JOIN artists a ON a.id = e.artist_id
                WHERE e.organizer_id IS NULL AND e.event_date >= now() AND e.is_approved
                  AND e.delisted_reason IS NULL AND e.merged_into_event_id IS NULL
                  AND (%s LIKE ? ESCAPE '!' OR %s LIKE ? ESCAPE '!' OR %s LIKE ? ESCAPE '!')
                ORDER BY e.event_date ASC LIMIT 30
                """.formatted(DATE.formatted("e.event_date"), fold.formatted("e.name"), fold.formatted("a.name"), fold.formatted("v.name")),
                org.getId(), p, p, p);
    }

    @Transactional
    public Map<String, Object> claim(Long userId, Long eventId, String message) {
        Organizer org = organizerService.requireOrganizer(userId);
        Event event = eventRepository.findById(eventId).orElseThrow(() -> new ResourceNotFoundException("EVENT_NOT_FOUND"));
        if (event.getMergedIntoEventId() != null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "EVENT_MERGED");
        if (event.getOrganizerId() != null) throw new ResponseStatusException(HttpStatus.CONFLICT, "EVENT_HAS_ORGANIZER");
        if (event.getEventDate() != null && event.getEventDate().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "EVENT_PAST");
        }
        if (claimRepository.existsByEventIdAndOrganizerIdAndStatus(eventId, org.getId(), EventClaim.Status.PENDING)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "CLAIM_PENDING");
        }
        String note = message == null ? null : message.trim();
        if (note != null && note.length() > 1000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "MESSAGE_TOO_LONG");
        EventClaim saved = claimRepository.save(new EventClaim(eventId, org.getId(), note == null || note.isEmpty() ? null : note));
        return Map.of("id", saved.getId(), "status", saved.getStatus().name());
    }

    public List<Map<String, Object>> myClaims(Long userId) {
        Organizer org = organizerService.requireOrganizer(userId);
        return jdbc.queryForList("""
                SELECT c.id, c.status, c.message, c.review_note AS "reviewNote", %s AS "createdAt",
                       e.id AS "eventId", e.name AS "eventName", %s AS "eventDate", v.name AS "venueName", v.city AS "venueCity"
                FROM event_claims c JOIN events e ON e.id = c.event_id LEFT JOIN venues v ON v.id = e.venue_id
                WHERE c.organizer_id = ? ORDER BY c.created_at DESC LIMIT 50
                """.formatted(DATE.formatted("c.created_at"), DATE.formatted("e.event_date")), org.getId());
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    /** status: PENDING (eskiden yeniye) | APPROVED | REJECTED | ALL */
    public List<Map<String, Object>> adminList(String status) {
        String s = status == null ? "PENDING" : status.toUpperCase(Locale.ROOT);
        boolean all = "ALL".equals(s);
        if (!all && !Set.of("PENDING", "APPROVED", "REJECTED").contains(s)) throw new IllegalArgumentException("INVALID_STATUS");
        String sql = """
                SELECT c.id, c.status, c.message, c.review_note AS "reviewNote", c.reviewed_by AS "reviewedBy",
                       %s AS "createdAt",
                       e.id AS "eventId", e.name AS "eventName", %s AS "eventDate", e.source, e.source_url AS "sourceUrl",
                       e.ticket_url AS "ticketUrl", e.image_url AS "imageUrl", e.organizer_id AS "currentOrganizerId",
                       v.name AS "venueName", v.city AS "venueCity",
                       o.id AS "organizerId", o.name AS "organizerName", o.verified AS "organizerVerified", o.active AS "organizerActive",
                       o.website AS "organizerWebsite", o.instagram AS "organizerInstagram",
                       (SELECT count(*) FROM events x WHERE x.organizer_id = o.id) AS "organizerEvents"
                FROM event_claims c
                JOIN events e ON e.id = c.event_id
                JOIN organizers o ON o.id = c.organizer_id
                LEFT JOIN venues v ON v.id = e.venue_id
                %s
                ORDER BY c.created_at %s LIMIT 200
                """.formatted(DATE.formatted("c.created_at"), DATE.formatted("e.event_date"),
                all ? "" : "WHERE c.status = ?", "PENDING".equals(s) ? "ASC" : "DESC");
        return all ? jdbc.queryForList(sql) : jdbc.queryForList(sql, s);
    }

    @Transactional
    public String approve(Long claimId, String adminName) {
        EventClaim claim = pending(claimId);
        Event event = eventRepository.findById(claim.getEventId()).orElseThrow(() -> new ResourceNotFoundException("EVENT_NOT_FOUND"));
        if (event.getOrganizerId() != null && !Objects.equals(event.getOrganizerId(), claim.getOrganizerId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "EVENT_HAS_ORGANIZER");
        }
        Organizer org = organizerRepository.findById(claim.getOrganizerId())
                .orElseThrow(() -> new ResourceNotFoundException("ORGANIZER_NOT_FOUND"));
        event.setOrganizerId(org.getId());
        event.setIsVerified(true);
        eventRepository.save(event);
        decide(claim, EventClaim.Status.APPROVED, null, adminName);
        notify(org, "claim_approved", event, event.getName());

        // Aynı etkinliğe gelen diğer bekleyen talepler kapanır
        for (EventClaim other : claimRepository.findByEventIdAndStatus(event.getId(), EventClaim.Status.PENDING)) {
            decide(other, EventClaim.Status.REJECTED, "Etkinlik başka bir organizatöre bağlandı.", adminName);
            organizerRepository.findById(other.getOrganizerId())
                    .ifPresent(o -> notify(o, "claim_rejected", event, "Etkinlik başka bir organizatöre bağlandı."));
        }
        return "claim approve #" + claimId + " event#" + event.getId() + " → " + org.getName();
    }

    @Transactional
    public String reject(Long claimId, String note, String adminName) {
        EventClaim claim = pending(claimId);
        String n = note == null || note.isBlank() ? null : note.trim();
        if (n != null && n.length() > 500) n = n.substring(0, 500);
        decide(claim, EventClaim.Status.REJECTED, n, adminName);
        Event event = eventRepository.findById(claim.getEventId()).orElse(null);
        String why = n;
        if (event != null) {
            organizerRepository.findById(claim.getOrganizerId()).ifPresent(o -> notify(o, "claim_rejected", event, why));
        }
        return "claim reject #" + claimId + (n == null ? "" : ": " + n);
    }

    private EventClaim pending(Long claimId) {
        EventClaim c = claimRepository.findById(claimId).orElseThrow(() -> new ResourceNotFoundException("CLAIM_NOT_FOUND"));
        if (c.getStatus() != EventClaim.Status.PENDING) throw new ResponseStatusException(HttpStatus.CONFLICT, "CLAIM_ALREADY_REVIEWED");
        return c;
    }

    private void decide(EventClaim c, EventClaim.Status status, String note, String adminName) {
        c.setStatus(status);
        c.setReviewNote(note);
        c.setReviewedBy(adminName);
        c.setReviewedAt(LocalDateTime.now());
        claimRepository.save(c);
    }

    private void notify(Organizer org, String type, Event event, String message) {
        if (org.getOwner() == null) return;
        // Aynı etkinlik için onay ve ret ayrı türler; tekrar engeli doğru çalışır
        notificationService.sendSystem(org.getOwner().getId(), type, "event", event.getId(),
                message == null ? event.getName() : message);
    }
}
