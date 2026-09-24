package com.concertly.backend.controller;

import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.ConcertDayService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** "Konser Günü" kartı ve "Konsere Hazırlan" ekranı. Giriş gerektirir. */
@RestController
@RequestMapping("/api/concert-day")
public class ConcertDayController {

    private final ConcertDayService concertDayService;

    public ConcertDayController(ConcertDayService concertDayService) {
        this.concertDayService = concertDayService;
    }

    // GET /api/concert-day/next → en yakın "gidiyorum" konseri, yoksa 204
    @GetMapping("/next")
    public ResponseEntity<ConcertDayService.ConcertDayResponse> next() {
        ConcertDayService.ConcertDayResponse next = concertDayService.next(JwtUtil.getCurrentUserId());
        return next == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(next);
    }

    // GET /api/concert-day/events/{eventId}
    @GetMapping("/events/{eventId}")
    public ConcertDayService.ConcertDayResponse forEvent(@PathVariable Long eventId) {
        return concertDayService.forEvent(JwtUtil.getCurrentUserId(), eventId);
    }
}
