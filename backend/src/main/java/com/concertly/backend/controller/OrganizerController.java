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
    private final com.concertly.backend.service.OrganizerProfileService profileService;
    private final com.concertly.backend.service.OrganizerAnnouncementService announcementService;
    private final com.concertly.backend.service.EventClaimService claimService;

    public OrganizerController(OrganizerService organizerService, OrganizerEventService organizerEventService,
                               com.concertly.backend.service.OrganizerProfileService profileService,
                               com.concertly.backend.service.OrganizerAnnouncementService announcementService,
                               com.concertly.backend.service.EventClaimService claimService) {
        this.organizerService = organizerService;
        this.organizerEventService = organizerEventService;
        this.profileService = profileService;
        this.announcementService = announcementService;
        this.claimService = claimService;
    }

    /** Kendi profilim: { bio?, logoUrl?, website?, instagram? } (ad değişmez). */
    @PutMapping("/profile")
    public Map<String, Object> updateProfile(@RequestBody Map<String, Object> body) {
        return profileService.updateOwn(JwtUtil.getCurrentUserId(), body);
    }

    // ── Katılımcılara duyuru ─────────────────────────────────────────────────

    @GetMapping("/events/{id}/announcements")
    public Map<String, Object> announcements(@PathVariable Long id) {
        return announcementService.overview(JwtUtil.getCurrentUserId(), id);
    }

    /** Gövde: { message, audience: GOING | GOING_INTERESTED } — etkinlik başına 24 saatte bir. */
    @PostMapping("/events/{id}/announce")
    public Map<String, Object> announce(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return announcementService.announce(JwtUtil.getCurrentUserId(), id, body.get("message"), body.get("audience"));
    }

    // ── Etkinlik sahiplenme ──────────────────────────────────────────────────

    @GetMapping("/claimable")
    public List<Map<String, Object>> claimable(@RequestParam(required = false) String q) {
        return claimService.claimable(JwtUtil.getCurrentUserId(), q);
    }

    @GetMapping("/claims")
    public List<Map<String, Object>> myClaims() {
        return claimService.myClaims(JwtUtil.getCurrentUserId());
    }

    /** Gövde: { eventId, message? } */
    @PostMapping("/claims")
    public Map<String, Object> claim(@RequestBody Map<String, Object> body) {
        Long eventId;
        try {
            eventId = Long.valueOf(String.valueOf(body.get("eventId")));
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("INVALID_EVENT");
        }
        return claimService.claim(JwtUtil.getCurrentUserId(), eventId,
                body.get("message") == null ? null : String.valueOf(body.get("message")));
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
