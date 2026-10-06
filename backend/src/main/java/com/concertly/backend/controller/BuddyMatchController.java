package com.concertly.backend.controller;

import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.BuddyMatchService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Konser Arkadaşı: deste, kaydırma, geri alma, eşleşmeler (iş kuralları BuddyMatchService'te). */
@RestController
@RequestMapping("/api/buddy")
public class BuddyMatchController {

    private final BuddyMatchService buddyMatchService;

    public BuddyMatchController(BuddyMatchService buddyMatchService) {
        this.buddyMatchService = buddyMatchService;
    }

    /** Deste + gideceğim konserler (arkadaş arama aç/kapa) + beni beğenen sayısı. */
    @GetMapping("/discover")
    public Map<String, Object> discover(@RequestParam(required = false) Long eventId) {
        return buddyMatchService.discover(JwtUtil.getCurrentUserId(), eventId);
    }

    @PostMapping("/swipe")
    public Map<String, Object> swipe(@RequestBody Map<String, Object> body) {
        Object liked = body == null ? null : body.get("liked");
        if (liked == null) throw new IllegalArgumentException("targetId ve liked zorunlu.");
        return buddyMatchService.swipe(JwtUtil.getCurrentUserId(), targetIdOf(body), Boolean.parseBoolean(liked.toString()));
    }

    @PostMapping("/undo")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void undo(@RequestBody Map<String, Object> body) {
        buddyMatchService.undo(JwtUtil.getCurrentUserId(), targetIdOf(body));
    }

    @GetMapping("/matches")
    public List<Map<String, Object>> getMatches() {
        return buddyMatchService.matches(JwtUtil.getCurrentUserId());
    }

    @DeleteMapping("/matches/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unmatch(@PathVariable Long userId) {
        buddyMatchService.unmatch(JwtUtil.getCurrentUserId(), userId);
    }

    private static Long targetIdOf(Map<String, Object> body) {
        Object raw = body == null ? null : body.get("targetId");
        if (raw == null) throw new IllegalArgumentException("targetId ve liked zorunlu.");
        try {
            return Long.valueOf(raw.toString());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Geçersiz targetId.");
        }
    }
}
