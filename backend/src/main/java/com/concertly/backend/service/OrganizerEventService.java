package com.concertly.backend.service;

import com.concertly.backend.config.LaunchCityConfig;
import com.concertly.backend.dto.request.SuggestEventRequest;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.Organizer;
import com.concertly.backend.model.Venue;
import com.concertly.backend.repository.MergePointers;
import com.concertly.backend.repository.VenueRepository;
import com.concertly.backend.repository.EventRepository;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Organizatör paneli: organizatörün kendi etkinlikleri.
 *
 * Organizatör yalnız organizer_id'si kendisine ait etkinliği düzenler/iptal eder; bilet
 * sitelerinden gelen kayıtlara dokunamaz (onlar için sahiplenme talebi ayrı akış).
 * Etkinlik onay beklemeden yayına girer ve "doğrulanmış kaynak" rozeti alır.
 */
@Service
public class OrganizerEventService {

    private static final Pattern UPLOAD_PATH = Pattern.compile("^/uploads/[A-Za-z0-9._-]+$");

    private final OrganizerService organizerService;
    private final EventSuggestionService suggestionService;
    private final EventCancellationService cancellationService;
    private final EventRepository eventRepository;
    private final LaunchCityConfig launchCityConfig;
    private final JdbcTemplate jdbc;
    private final VenueRepository venueRepository;
    private final AdminContentService contentService;
    // Takipçi bildirimi isteğe bağlı bağımlılık (testlerde yok)
    private OrganizerProfileService profileService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setProfileService(OrganizerProfileService profileService) {
        this.profileService = profileService;
    }

    public OrganizerEventService(OrganizerService organizerService,
                                 EventSuggestionService suggestionService,
                                 EventCancellationService cancellationService,
                                 EventRepository eventRepository,
                                 LaunchCityConfig launchCityConfig,
                                 JdbcTemplate jdbc,
                                 VenueRepository venueRepository,
                                 AdminContentService contentService) {
        this.organizerService = organizerService;
        this.suggestionService = suggestionService;
        this.cancellationService = cancellationService;
        this.eventRepository = eventRepository;
        this.launchCityConfig = launchCityConfig;
        this.jdbc = jdbc;
        this.venueRepository = venueRepository;
        this.contentService = contentService;
    }

    /** Formdaki mekân listesi: kayıtlı mekânlar (ad ve şehre göre), yaklaşan konseri çok olan önce. */
    public List<Map<String, Object>> venues(Long userId, String q, String city, int page) {
        organizerService.requireOrganizer(userId);
        return contentService.listVenues(q, city, page);
    }

    /** Panelin üst özeti ve etkinlik listesi (scope: upcoming | past), her etkinliğin istatistiğiyle. */
    public Map<String, Object> dashboard(Long userId, String scope) {
        Organizer org = organizerService.requireOrganizer(userId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("organizer", OrganizerService.summary(org));
        out.put("totals", totalsOf(org.getId()));
        out.put("events", eventsOf(org.getId(), "past".equals(scope)));
        return out;
    }

    /** Bir organizatörün etkinlikleri ve istatistikleri (panel ve admin ortak). */
    public List<Map<String, Object>> eventsOf(Long organizerId, boolean past) {
        return jdbc.queryForList("""
                SELECT e.id, e.name, to_char(e.event_date, 'YYYY-MM-DD"T"HH24:MI:SS') AS "eventDate",
                       e.image_url AS "imageUrl",
                       e.ticket_url AS "ticketUrl", e.description, e.delisted_reason AS "delistedReason",
                       coalesce(e.view_count, 0) AS views,
                       v.id AS "venueId", v.name AS "venueName", v.city AS "venueCity", v.address AS "venueAddress",
                       a.name AS "artistName",
                       (SELECT count(*) FROM event_attendances x WHERE x.event_id = e.id AND x.status = 'GOING') AS going,
                       (SELECT count(*) FROM event_attendances x WHERE x.event_id = e.id AND x.status = 'INTERESTED') AS interested,
                       (SELECT count(*) FROM event_attendances x WHERE x.event_id = e.id AND x.status = 'WENT') AS went,
                       (SELECT count(*) FROM event_bookmarks b WHERE b.event_id = e.id) AS saves,
                       (SELECT count(*) FROM concert_buddies c WHERE c.event_id = e.id) AS buddies
                FROM events e
                LEFT JOIN venues v ON v.id = e.venue_id
                LEFT JOIN artists a ON a.id = e.artist_id
                WHERE e.organizer_id = ? AND e.merged_into_event_id IS NULL
                  AND (e.delisted_reason IS NULL OR e.delisted_reason = 'CANCELLED')
                  AND %s
                ORDER BY e.event_date %s
                LIMIT 200
                """.formatted(past ? "e.event_date < now()" : "e.event_date >= now()", past ? "DESC" : "ASC"),
                organizerId);
    }

    /** Yaklaşan etkinlik, toplam görüntülenme ve yaklaşanlarda "gidiyor" toplamı. */
    public Map<String, Object> totalsOf(Long organizerId) {
        return jdbc.queryForMap("""
                SELECT count(*) FILTER (WHERE e.event_date >= now() AND e.delisted_reason IS NULL) AS upcoming,
                       coalesce(sum(coalesce(e.view_count, 0)), 0) AS views,
                       (SELECT count(*) FROM event_attendances x JOIN events y ON y.id = x.event_id
                          WHERE y.organizer_id = ? AND x.status = 'GOING' AND y.event_date >= now()) AS going
                FROM events e
                WHERE e.organizer_id = ? AND e.merged_into_event_id IS NULL
                """, organizerId, organizerId);
    }

    /** Yeni etkinlik: doğrudan yayına girer, organizatöre bağlanır. Mükerrerse 409 (sahiplenme önerilir). */
    @Transactional
    public Map<String, Object> create(Long userId, SuggestEventRequest request) {
        Organizer org = organizerService.requireOrganizer(userId);
        normalizeLinks(request);
        // Bilet linki ve listeden seçilmiş mekân zorunlu (serbest mekân adı kabul edilmez)
        if (request.getTicketUrl() == null || request.getTicketUrl().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "TICKET_URL_REQUIRED");
        }
        if (request.getVenueId() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "VENUE_REQUIRED");
        Venue venue = pickVenue(request.getVenueId());
        request.setVenueName(venue.getName());
        request.setVenueCity(venue.getCity());
        request.setVenueAddress(venue.getAddress());
        request.setVenueId(venue.getId());
        Event event = suggestionService.create(userId, request, true, org.getId());
        // Organizatörü takip edenlere "yeni etkinlik" bildirimi
        if (profileService != null) profileService.notifyFollowers(org, event);
        return Map.of("id", event.getId());
    }

    /**
     * Kendi etkinliğini düzenler. Gelmeyen alan değişmez; sanatçı/mekân adla yeniden eşlenir.
     * Geçmiş ya da başka organizatörün etkinliği düzenlenemez.
     */
    @Transactional
    public Map<String, Object> update(Long userId, Long eventId, SuggestEventRequest body) {
        Event event = owned(userId, eventId);
        if (event.getEventDate() != null && event.getEventDate().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "EVENT_PAST");
        }
        normalizeLinks(body);

        if (body.getName() != null) {
            String name = body.getName().trim();
            if (name.isEmpty() || name.length() > 200) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_NAME");
            event.setName(name);
        }
        if (body.getDescription() != null) {
            String d = body.getDescription().trim();
            if (d.length() > 4000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "DESCRIPTION_TOO_LONG");
            event.setDescription(d.isEmpty() ? null : d);
        }
        if (body.getEventDate() != null) {
            if (body.getEventDate().isBefore(LocalDateTime.now())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "DATE_IN_PAST");
            }
            event.setEventDate(body.getEventDate());
        }
        if (body.getTicketUrl() != null) {
            if (body.getTicketUrl().isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "TICKET_URL_REQUIRED");
            event.setTicketUrl(body.getTicketUrl());
        }
        if (body.getImageUrl() != null) event.setImageUrl(body.getImageUrl().isEmpty() ? null : body.getImageUrl());

        if (body.getArtistName() != null && !body.getArtistName().isBlank()) {
            SuggestEventRequest lookup = new SuggestEventRequest();
            lookup.setName(event.getName());
            lookup.setArtistName(body.getArtistName());
            lookup.setArtistGenre(body.getArtistGenre());
            event.setArtist(suggestionService.findOrCreateArtist(lookup));
            if (event.getArtist().getGenre() != null) event.setGenre(event.getArtist().getGenre());
        }
        // Mekân yalnız listeden seçilerek değişir
        if (body.getVenueId() != null) event.setVenue(pickVenue(body.getVenueId()));
        eventRepository.save(event);
        return Map.of("id", event.getId());
    }

    /** İptal: listelerden düşer, katılımcılara bildirim gider. */
    @Transactional
    public void cancel(Long userId, Long eventId) {
        Event event = owned(userId, eventId);
        cancellationService.cancel(event);
    }

    /** İptali geri al (yalnız tarihi geçmemişse). */
    @Transactional
    public void uncancel(Long userId, Long eventId) {
        Event event = owned(userId, eventId);
        if (event.getEventDate() != null && event.getEventDate().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "EVENT_PAST");
        }
        cancellationService.uncancelById(event.getId());
    }

    /** Kayıtlı mekân (birleştirilmişse asıl kayıt); şehri açık olmalı. */
    private Venue pickVenue(Long venueId) {
        Venue venue = MergePointers.canonical(venueRepository.findById(venueId), venueRepository)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "VENUE_NOT_FOUND"));
        if (venue.getCity() == null || !launchCityConfig.contains(venue.getCity())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CITY_NOT_SUPPORTED");
        }
        return venue;
    }

    private Event owned(Long userId, Long eventId) {
        Organizer org = organizerService.requireOrganizer(userId);
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("EVENT_NOT_FOUND"));
        if (!Objects.equals(event.getOrganizerId(), org.getId()) || event.getMergedIntoEventId() != null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "NOT_YOUR_EVENT");
        }
        return event;
    }

    /** Bilet bağlantısı yalnız http(s); görsel yalnız kendi yüklememiz ya da https. Boş = temizle. */
    static void normalizeLinks(SuggestEventRequest r) {
        if (r.getTicketUrl() != null) {
            String t = r.getTicketUrl().trim();
            if (!t.isEmpty() && !(t.startsWith("https://") || t.startsWith("http://")) || t.length() > 500 || t.contains(" ")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_TICKET_URL");
            }
            r.setTicketUrl(t);
        }
        if (r.getImageUrl() != null) {
            String i = r.getImageUrl().trim();
            if (!i.isEmpty() && !UPLOAD_PATH.matcher(i).matches() && !(i.startsWith("https://") && !i.contains(" "))) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_IMAGE_URL");
            }
            r.setImageUrl(i);
        }
    }
}
