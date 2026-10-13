package com.concertly.backend.service;

import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.Organizer;
import com.concertly.backend.model.OrganizerAnnouncement;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.OrganizerAnnouncementRepository;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Organizatörün kendi etkinliğine "gidiyorum" (isteğe göre "ilgileniyorum") diyenlere duyurusu
 * (ör. "Kapılar 20:00'de açılıyor"). Spam olmasın diye etkinlik başına 24 saatte bir; admin
 * organizatörün duyuru yetkisini kapatabilir. Duyuru bildirim ve push olarak gider.
 */
@Service
public class OrganizerAnnouncementService {

    public static final String GOING = "GOING";
    public static final String GOING_INTERESTED = "GOING_INTERESTED";
    static final int COOLDOWN_HOURS = 24;

    private final OrganizerService organizerService;
    private final EventRepository eventRepository;
    private final OrganizerAnnouncementRepository announcementRepository;
    private final NotificationService notificationService;
    private final JdbcTemplate jdbc;

    public OrganizerAnnouncementService(OrganizerService organizerService,
                                        EventRepository eventRepository,
                                        OrganizerAnnouncementRepository announcementRepository,
                                        NotificationService notificationService,
                                        JdbcTemplate jdbc) {
        this.organizerService = organizerService;
        this.eventRepository = eventRepository;
        this.announcementRepository = announcementRepository;
        this.notificationService = notificationService;
        this.jdbc = jdbc;
    }

    /** Duyuru ekranı: geçmiş duyurular, yetki, bir sonraki izin zamanı ve olası alıcı sayıları. */
    public Map<String, Object> overview(Long userId, Long eventId) {
        Organizer org = organizerService.requireOrganizer(userId);
        Event event = owned(org, eventId);
        List<OrganizerAnnouncement> past = announcementRepository.findByEventIdOrderByCreatedAtDesc(event.getId());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("canAnnounce", org.isCanAnnounce());
        out.put("nextAllowedAt", past.isEmpty() ? null : nextAllowed(past.get(0)));
        out.put("going", count(event.getId(), false, ownerId(org)));
        out.put("goingInterested", count(event.getId(), true, ownerId(org)));
        out.put("history", past.stream().map(a -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", a.getId());
            m.put("message", a.getMessage());
            m.put("audience", a.getAudience());
            m.put("recipients", a.getRecipients());
            m.put("createdAt", a.getCreatedAt());
            return m;
        }).toList());
        return out;
    }

    @Transactional
    public Map<String, Object> announce(Long userId, Long eventId, String message, String audience) {
        Organizer org = organizerService.requireOrganizer(userId);
        if (!org.isCanAnnounce()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "ANNOUNCE_DISABLED");
        Event event = owned(org, eventId);
        if (EventCancellationService.isCancelled(event)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "EVENT_CANCELLED");
        // Konser gecesi de duyuru yapılabilsin: etkinlik saatinden 12 saat sonrasına kadar
        if (event.getEventDate() != null && event.getEventDate().plusHours(12).isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "EVENT_PAST");
        }
        String text = message == null ? "" : message.trim().replaceAll("\\s+", " ");
        if (text.length() < 3 || text.length() > 300) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "MESSAGE_INVALID");
        String who = GOING_INTERESTED.equals(audience) ? GOING_INTERESTED : GOING;
        if (announcementRepository.existsByEventIdAndCreatedAtAfter(event.getId(), LocalDateTime.now().minusHours(COOLDOWN_HOURS))) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "ANNOUNCE_LIMIT");
        }

        List<Long> recipients = recipients(event.getId(), GOING_INTERESTED.equals(who), ownerId(org));
        String body = org.getName() + ": " + text;
        // Her duyuru ayrı ulaşmalı: tekrar engeli olmayan gönderim (sınır yukarıdaki 24 saat kuralı)
        for (Long uid : recipients) {
            notificationService.sendSystemAlways(uid, "event_announcement", "event", event.getId(), body);
        }
        OrganizerAnnouncement saved = announcementRepository.save(
                new OrganizerAnnouncement(org.getId(), event.getId(), text, who, recipients.size()));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("recipients", recipients.size());
        out.put("nextAllowedAt", nextAllowed(saved));
        return out;
    }

    private Event owned(Organizer org, Long eventId) {
        Event event = eventRepository.findById(eventId).orElseThrow(() -> new ResourceNotFoundException("EVENT_NOT_FOUND"));
        if (!Objects.equals(event.getOrganizerId(), org.getId()) || event.getMergedIntoEventId() != null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "NOT_YOUR_EVENT");
        }
        return event;
    }

    private List<Long> recipients(Long eventId, boolean withInterested, Long excludeUserId) {
        return jdbc.queryForList("""
                SELECT DISTINCT a.user_id FROM event_attendances a JOIN users u ON u.id = a.user_id
                WHERE a.event_id = ? AND a.status IN (%s) AND coalesce(u.is_active, true) AND a.user_id <> ?
                """.formatted(withInterested ? "'GOING', 'INTERESTED'" : "'GOING'"), Long.class, eventId, excludeUserId);
    }

    private long count(Long eventId, boolean withInterested, Long excludeUserId) {
        return recipients(eventId, withInterested, excludeUserId).size();
    }

    private static Long ownerId(Organizer org) {
        return org.getOwner() != null ? org.getOwner().getId() : -1L;
    }

    private static LocalDateTime nextAllowed(OrganizerAnnouncement a) {
        LocalDateTime next = a.getCreatedAt().plusHours(COOLDOWN_HOURS);
        return next.isAfter(LocalDateTime.now()) ? next : null;
    }
}
