package com.concertly.backend.controller;

import com.concertly.backend.dto.response.ConcertResponse;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventSourceLink;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.EventSourceLinkRepository;
import com.concertly.backend.service.ingest.ConcertGrouping;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Mobil uygulamanin konser listesi.
 *
 * Tek is yapar: veritabanindaki yayinda ve gelecekteki konserleri sayfali
 * doner. Kaynaklarin (Ticketmaster, Biletinial, ...) varligindan haberi yok;
 * hangi kaynagin veriyi getirdigi cevapta da gecmez.
 */
@RestController
@RequestMapping("/api/concerts")
public class ConcertController {

    private static final int MAX_PAGE_SIZE = 100;

    private final EventRepository eventRepository;
    private final EventSourceLinkRepository sourceLinkRepository;
    private final ConcertGrouping grouping;

    public ConcertController(EventRepository eventRepository,
            EventSourceLinkRepository sourceLinkRepository,
            ConcertGrouping grouping) {
        this.eventRepository = eventRepository;
        this.sourceLinkRepository = sourceLinkRepository;
        this.grouping = grouping;
    }

    /**
     * GET /api/concerts
     * GET /api/concerts?city=Ankara
     * GET /api/concerts?artist=Duman
     * GET /api/concerts?past=true   (gecmis konserler, en yeni once)
     *
     * Sehir ve sanatci suzgecleri Turkce karakter ve buyuk/kucuk harf farkina
     * duyarsizdir; ikisi birlikte de kullanilabilir.
     */
    @GetMapping
    public Map<String, Object> list(
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String artist,
            @RequestParam(defaultValue = "false") boolean past,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);

        // Yaklasan konserler en yakin tarih once; gecmis konserler en yeni once.
        // id ikinci anahtar: ayni saatteki konserlerin sirasi sabit olmazsa
        // sayfalar arasinda ayni kayit iki kez gelip bir digeri atlanabilir.
        Sort sort = Sort.by(past ? Sort.Direction.DESC : Sort.Direction.ASC, "event_date")
                .and(Sort.by(Sort.Direction.ASC, "id"));
        String cityFilter = blankToNull(city);
        String artistFilter = blankToNull(artist);
        LocalDateTime now = LocalDateTime.now();
        Page<Event> result = eventRepository.searchConcerts(
                cityFilter, artistFilter, now, past,
                PageRequest.of(safePage, safeSize, sort));

        // Ayni konserin kopyalari tek kart olur. Kopyalar sayfanin disinda da
        // olabilir (saat farki toleransi kadar); pencere sorgusu bu yuzden sayfanin
        // iki ucundan tolerans kadar tasar. Asil kayit her sayfada ayni secildigi
        // icin bir kopya iki sayfada da kart olmaz.
        List<ConcertResponse> content = new ArrayList<>();
        if (!result.getContent().isEmpty()) {
            LocalDateTime first = result.getContent().get(0).getEventDate();
            LocalDateTime last = result.getContent().get(result.getContent().size() - 1).getEventDate();
            LocalDateTime min = first.isBefore(last) ? first : last;
            LocalDateTime max = first.isBefore(last) ? last : first;
            long tolerance = grouping.toleranceMinutes();
            List<Event> window = eventRepository.findConcertsBetween(cityFilter, artistFilter, now, past,
                    min.minusMinutes(tolerance), max.plusMinutes(tolerance));
            Map<Long, Event> candidates = new LinkedHashMap<>();
            for (Event e : window) candidates.put(e.getId(), e);
            for (Event e : result.getContent()) candidates.putIfAbsent(e.getId(), e);
            Map<Long, ConcertGrouping.Group> groups = grouping.group(candidates.values());

            // Bilet adresleri sayfa icin TEK sorguda yuklenir; etkinlik basina ayri
            // sorgu (N+1) olmasin.
            Set<Long> ids = new LinkedHashSet<>();
            for (Event e : result.getContent()) {
                ConcertGrouping.Group g = groups.get(e.getId());
                if (g.canonical().getId().equals(e.getId())) {
                    g.members().forEach(m -> ids.add(m.getId()));
                }
            }
            List<EventSourceLink> links = ids.isEmpty() ? List.of() : sourceLinkRepository.findByEventIdIn(ids);
            for (Event e : result.getContent()) {
                ConcertGrouping.Group g = groups.get(e.getId());
                if (!g.canonical().getId().equals(e.getId())) continue;   // kopya: asil kayit gosteriliyor
                Set<Long> memberIds = new LinkedHashSet<>();
                g.members().forEach(m -> memberIds.add(m.getId()));
                List<EventSourceLink> own = links.stream()
                        .filter(l -> memberIds.contains(l.getEvent().getId())).toList();
                content.add(ConcertResponse.fromGroup(e, g.members(), own));
            }
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("content", content);
        body.put("page", result.getNumber());
        body.put("size", result.getSize());
        body.put("totalElements", result.getTotalElements());
        body.put("totalPages", result.getTotalPages());
        body.put("last", result.isLast());
        return body;
    }

    /**
     * GET /api/concerts/{id}/tickets
     *
     * Etkinlik detayindaki "Bilet Al" icin konserin gecerli tum bilet adresleri:
     * kendi kaynaklari + ayni konserin henuz birlestirilmemis kopyalarinin
     * kaynaklari. Birlestirilmis bir kopya acilirsa asil kaydinkiler doner.
     */
    @GetMapping("/{id}/tickets")
    public List<ConcertResponse.TicketLink> tickets(@PathVariable Long id) {
        Event event = eventRepository.findById(id).orElse(null);
        if (event == null) return List.of();
        if (event.getMergedIntoEventId() != null) {
            Event canonical = eventRepository.findById(event.getMergedIntoEventId()).orElse(null);
            if (canonical != null) event = canonical;
        }
        List<Event> members = List.of(event);
        if (event.getEventDate() != null && Boolean.TRUE.equals(event.getIsApproved())) {
            long tolerance = grouping.toleranceMinutes();
            LocalDateTime now = LocalDateTime.now();
            boolean past = event.getEventDate().isBefore(now);
            List<Event> window = new ArrayList<>(eventRepository.findConcertsBetween(null, null, now, past,
                    event.getEventDate().minusMinutes(tolerance), event.getEventDate().plusMinutes(tolerance)));
            final Long eventId = event.getId();
            if (window.stream().noneMatch(e -> e.getId().equals(eventId))) window.add(event);
            ConcertGrouping.Group g = grouping.group(window).get(eventId);
            if (g != null) {
                List<Event> ordered = new ArrayList<>();
                ordered.add(event);
                g.members().stream().filter(m -> !m.getId().equals(eventId)).forEach(ordered::add);
                members = ordered;
            }
        }
        List<Long> ids = members.stream().map(Event::getId).toList();
        return ConcertResponse.resolveTicketLinks(members, sourceLinkRepository.findByEventIdIn(ids));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
