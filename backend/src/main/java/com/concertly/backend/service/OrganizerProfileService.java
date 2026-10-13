package com.concertly.backend.service;

import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.Organizer;
import com.concertly.backend.model.OrganizerFollow;
import com.concertly.backend.repository.OrganizerFollowRepository;
import com.concertly.backend.repository.OrganizerRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

/**
 * Organizatörün herkese açık profili: logo, açıklama, doğrulama rozeti, takipçiler ve yaklaşan
 * etkinlikleri. Takipçiler organizatörün yeni etkinliğinde bildirim alır. Askıdaki organizatörün
 * profili görünmez.
 */
@Service
public class OrganizerProfileService {

    private static final Logger log = LoggerFactory.getLogger(OrganizerProfileService.class);

    private final OrganizerRepository organizerRepository;
    private final OrganizerFollowRepository followRepository;
    private final OrganizerService organizerService;
    private final NotificationService notificationService;
    private final JdbcTemplate jdbc;

    public OrganizerProfileService(OrganizerRepository organizerRepository,
                                   OrganizerFollowRepository followRepository,
                                   OrganizerService organizerService,
                                   NotificationService notificationService,
                                   JdbcTemplate jdbc) {
        this.organizerRepository = organizerRepository;
        this.followRepository = followRepository;
        this.organizerService = organizerService;
        this.notificationService = notificationService;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> publicProfile(Long organizerId, Long viewerId) {
        Organizer o = active(organizerId);
        Map<String, Object> out = new LinkedHashMap<>(OrganizerService.summary(o));
        out.remove("canAnnounce");
        out.remove("active");
        out.put("followers", followRepository.countByOrganizerId(o.getId()));
        out.put("following", viewerId != null && followRepository.findByOrganizerIdAndUserId(o.getId(), viewerId).isPresent());
        out.put("isOwner", viewerId != null && o.getOwner() != null && viewerId.equals(o.getOwner().getId()));
        out.put("upcoming", jdbc.queryForList("""
                SELECT e.id, e.name, to_char(e.event_date, 'YYYY-MM-DD"T"HH24:MI:SS') AS "eventDate",
                       e.image_url AS "imageUrl", e.genre, v.name AS "venueName", v.city AS "venueCity",
                       (SELECT count(*) FROM event_attendances a WHERE a.event_id = e.id AND a.status = 'GOING') AS going
                FROM events e LEFT JOIN venues v ON v.id = e.venue_id
                WHERE e.organizer_id = ? AND e.event_date >= now() AND e.is_approved
                  AND e.delisted_reason IS NULL AND e.merged_into_event_id IS NULL
                ORDER BY e.event_date ASC LIMIT 50
                """, o.getId()));
        out.put("pastCount", jdbc.queryForObject("""
                SELECT count(*) FROM events WHERE organizer_id = ? AND event_date < now() AND merged_into_event_id IS NULL
                  AND (delisted_reason IS NULL OR delisted_reason = 'CANCELLED')
                """, Long.class, o.getId()));
        return out;
    }

    @Transactional
    public Map<String, Object> follow(Long organizerId, Long userId, boolean follow) {
        Organizer o = active(organizerId);
        if (o.getOwner() != null && Objects.equals(o.getOwner().getId(), userId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CANNOT_FOLLOW_SELF");
        }
        Optional<OrganizerFollow> existing = followRepository.findByOrganizerIdAndUserId(o.getId(), userId);
        if (follow && existing.isEmpty()) followRepository.save(new OrganizerFollow(o.getId(), userId));
        if (!follow) existing.ifPresent(followRepository::delete);
        return Map.of("following", follow, "followers", followRepository.countByOrganizerId(o.getId()));
    }

    /** Organizatör kendi profilini düzenler: açıklama, logo, web sitesi, Instagram (ad değişmez). */
    @Transactional
    public Map<String, Object> updateOwn(Long userId, Map<String, Object> body) {
        Organizer o = organizerService.requireOrganizer(userId);
        if (body.containsKey("bio")) o.setBio(blankToNull(AdminContentService.text(body.get("bio"), 0, 1000, "BIO_TOO_LONG")));
        if (body.containsKey("logoUrl")) o.setLogoUrl(AdminContentService.imageUrl(body.get("logoUrl")));
        if (body.containsKey("website")) o.setWebsite(blankToNull(link(body.get("website"))));
        if (body.containsKey("instagram")) o.setInstagram(blankToNull(AdminContentService.text(body.get("instagram"), 0, 500, "INVALID_INSTAGRAM")));
        organizerRepository.save(o);
        return OrganizerService.summary(o);
    }

    /** Yeni etkinlik takipçilere bildirilir (her biri için bir kez). Hata etkinlik kaydını bozmaz. */
    public void notifyFollowers(Organizer o, Event event) {
        try {
            String city = event.getVenue() != null && event.getVenue().getCity() != null ? " (" + event.getVenue().getCity() + ")" : "";
            String message = o.getName() + " — " + event.getName() + city;
            for (OrganizerFollow f : followRepository.findByOrganizerId(o.getId())) {
                notificationService.sendSystem(f.getUserId(), "organizer_event", "event", event.getId(), message);
            }
        } catch (Exception e) {
            log.warn("Organizator takipcilerine bildirim gonderilemedi ({}): {}", event.getId(), e.getMessage());
        }
    }

    private Organizer active(Long organizerId) {
        return organizerRepository.findById(organizerId)
                .filter(Organizer::isActive)
                .orElseThrow(() -> new ResourceNotFoundException("ORGANIZER_NOT_FOUND"));
    }

    private static String link(Object raw) {
        String s = AdminContentService.text(raw, 0, 500, "INVALID_WEBSITE");
        if (s.isEmpty()) return s;
        if (s.contains(" ") || s.startsWith("javascript:")) throw new IllegalArgumentException("INVALID_WEBSITE");
        return s;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }
}
