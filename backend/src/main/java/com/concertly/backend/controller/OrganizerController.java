package com.concertly.backend.controller;

import com.concertly.backend.dto.request.SuggestEventRequest;
import com.concertly.backend.dto.response.OrganizerRequestResponse;
import com.concertly.backend.model.OrganizerRequest;
import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.OrganizerEventService;
import com.concertly.backend.service.OrganizerService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Organizatör/mekan/menajer hesabı: başvuru (herkes) ve organizatör paneli (onaylı hesap). */
@RestController
@RequestMapping("/api/organizer")
public class OrganizerController {

    private final OrganizerService organizerService;
    private final OrganizerEventService organizerEventService;

    public OrganizerController(OrganizerService organizerService, OrganizerEventService organizerEventService) {
        this.organizerService = organizerService;
        this.organizerEventService = organizerEventService;
    }

    @PostMapping("/requests")
    public OrganizerRequestResponse apply(@RequestBody OrganizerRequest form) {
        return organizerService.apply(JwtUtil.getCurrentUserId(), form);
    }

    @GetMapping("/requests/me")
    public List<OrganizerRequestResponse> myRequests() {
        return organizerService.myRequests(JwtUtil.getCurrentUserId());
    }

    /** Etkinlik önerisinin onay beklemeden yayınlanıp yayınlanmayacağını gösterir. */
    @GetMapping("/status")
    public Map<String, Boolean> status() {
        return Map.of("trusted", organizerService.isTrustedOrganizer(JwtUtil.getCurrentUserId()));
    }

    /** Başvuru/hesap durumu: { state: NONE|PENDING|REJECTED|APPROVED|SUSPENDED, request, organizer }. */
    @GetMapping("/me")
    public Map<String, Object> me() {
        return organizerService.status(JwtUtil.getCurrentUserId());
    }

    // ── Panel (onaylı organizatör) ────────────────────────────────────────────

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard(@RequestParam(defaultValue = "upcoming") String scope) {
        return organizerEventService.dashboard(JwtUtil.getCurrentUserId(), scope);
    }

    /** Etkinlik formundaki mekân listesi (yalnız kayıtlı mekânlar seçilebilir). */
    @GetMapping("/venues")
    public List<Map<String, Object>> venues(@RequestParam(required = false) String q,
                                            @RequestParam(required = false) String city,
                                            @RequestParam(defaultValue = "0") int page) {
        return organizerEventService.venues(JwtUtil.getCurrentUserId(), q, city, page);
    }

    @PostMapping("/events")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> createEvent(@RequestBody SuggestEventRequest request) {
        return organizerEventService.create(JwtUtil.getCurrentUserId(), request);
    }

    @PutMapping("/events/{id}")
    public Map<String, Object> updateEvent(@PathVariable Long id, @RequestBody SuggestEventRequest body) {
        return organizerEventService.update(JwtUtil.getCurrentUserId(), id, body);
    }

    @PostMapping("/events/{id}/cancel")
    public Map<String, Object> cancel(@PathVariable Long id) {
        organizerEventService.cancel(JwtUtil.getCurrentUserId(), id);
        return Map.of("ok", true);
    }

    @PostMapping("/events/{id}/uncancel")
    public Map<String, Object> uncancel(@PathVariable Long id) {
        organizerEventService.uncancel(JwtUtil.getCurrentUserId(), id);
        return Map.of("ok", true);
    }
}
