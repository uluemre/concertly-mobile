package com.concertly.backend.controller;

import com.concertly.backend.dto.request.CreateEventRequest;
import com.concertly.backend.dto.request.SuggestEventRequest;
import com.concertly.backend.dto.response.EventResponse;
import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.EventService;
import com.concertly.backend.service.EventSuggestionService;
import com.concertly.backend.service.OrganizerService;
import com.concertly.backend.service.TicketmasterService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/events")
public class EventController {

    private final EventService eventService;
    private final TicketmasterService ticketmasterService;
    private final EventSuggestionService suggestionService;
    private final OrganizerService organizerService;

    public EventController(EventService eventService,
                           TicketmasterService ticketmasterService,
                           EventSuggestionService suggestionService,
                           OrganizerService organizerService) {
        this.eventService = eventService;
        this.ticketmasterService = ticketmasterService;
        this.suggestionService = suggestionService;
        this.organizerService = organizerService;
    }

    /**
     * Kullanıcı etkinlik önerisi — Ticketmaster dışı ikinci veri kanalı.
     * Doğrulanmış organizatörün önerisi doğrudan yayına girer, diğerleri
     * admin onay kuyruğuna düşer. Mükerrer etkinlik 409 ile reddedilir.
     */
    @PostMapping("/suggest")
    @ResponseStatus(HttpStatus.CREATED)
    public EventResponse suggestEvent(@RequestBody SuggestEventRequest request) {
        Long userId = JwtUtil.getCurrentUserId();
        return suggestionService.suggest(userId, request, organizerService.isTrustedOrganizer(userId));
    }

    /** Kendi önerilerim ve onay durumları. */
    @GetMapping("/suggestions/me")
    public List<EventResponse> mySuggestions() {
        return suggestionService.mySuggestions(JwtUtil.getCurrentUserId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EventResponse createEvent(@RequestBody CreateEventRequest request) {
        return eventService.createEvent(request);
    }

    @GetMapping
    public List<EventResponse> getEvents(
            @RequestParam(value = "city", required = false) String city,
            @RequestParam(value = "genres", required = false) String genresCsv,
            @RequestParam(value = "upcoming", required = false, defaultValue = "false") boolean upcoming,
            @RequestParam(value = "limit", required = false) Integer limit) {
        List<EventResponse> events;
        if (genresCsv != null && !genresCsv.isBlank()) {
            List<String> genres = Arrays.asList(genresCsv.split(","));
            events = eventService.getRecommendedEvents(city, genres);
        } else {
            events = eventService.getAllEvents(city);
        }
        // Geçmiş filtresini limit'ten ÖNCE uygula — yoksa dönen 40 kayıt geçmişle
        // dolup gelecekteki konserler "yok" görünebilir (4.3).
        if (upcoming) {
            var todayStart = LocalDate.now().atStartOfDay();
            events = events.stream()
                    .filter(e -> e.getEventDate() != null && !e.getEventDate().isBefore(todayStart))
                    .toList();
        }
        // limit verilmezse eski davranış korunur (tam liste)
        if (limit != null && limit > 0 && events.size() > limit) {
            return events.subList(0, limit);
        }
        return events;
    }

    @GetMapping("/{id}")
    public EventResponse getEvent(@PathVariable Long id) {
        return eventService.getEventById(id);
    }

    @PatchMapping("/{id}/approve")
    public EventResponse approveEvent(@PathVariable Long id) {
        return eventService.approveEvent(id);
    }

    // Yalnızca POST — SecurityConfig POST'u ADMIN'e kilitler. GET varyantı
    // "GET /api/events/**" permitAll kuralıyla anonim erişime açılıyordu (suistimal/maliyet).
    @PostMapping("/sync")
    public Map<String, Object> syncEvents() {
        System.out.println("🚀 /api/events/sync çağrıldı, Türkiye konser senkronizasyonu başlatılıyor...");
        int count = ticketmasterService.syncTurkeyEvents();
        System.out.println("✅ /api/events/sync bitti! Toplam: " + count + " etkinlik eklendi/güncellendi.");
        return Map.of("success", true, "message", count + " etkinlik eklendi.", "count", count);
    }

    @PostMapping("/enrich")
    public Map<String, Integer> enrichEvents() {
        return ticketmasterService.enrichMissingData();
    }
}