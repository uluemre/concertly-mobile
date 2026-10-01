package com.concertly.backend.controller;

import com.concertly.backend.dto.response.EventResponse;
import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.EventBookmarkService;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class EventBookmarkController {

    private final EventBookmarkService bookmarkService;

    public EventBookmarkController(EventBookmarkService bookmarkService) {
        this.bookmarkService = bookmarkService;
    }

    // Kaydet / kaydı kaldır (toggle)
    @PostMapping("/events/{eventId}/bookmark")
    public Map<String, Boolean> toggle(@PathVariable Long eventId) {
        Long userId = JwtUtil.getCurrentUserId();
        boolean bookmarked = bookmarkService.toggleBookmark(userId, eventId);
        return Map.of("bookmarked", bookmarked);
    }

    // Mevcut durumu sorgula
    @GetMapping("/events/{eventId}/bookmark")
    public Map<String, Boolean> status(@PathVariable Long eventId) {
        Long userId = JwtUtil.getCurrentUserId();
        // Giriş yapmamış izleyici için güvenli değer (GET /api/events/** herkese açık)
        if (userId == null) return Map.of("bookmarked", false);
        boolean bookmarked = bookmarkService.isBookmarked(userId, eventId);
        return Map.of("bookmarked", bookmarked);
    }

    // Kullanıcının tüm kaydedilen etkinlikleri
    @GetMapping("/users/{userId}/bookmarks")
    public List<EventResponse> getUserBookmarks(@PathVariable Long userId) {
        // Kaydedilenler özeldir: yalnızca sahibi görebilir (SEC-02)
        if (userId == null || !userId.equals(JwtUtil.getCurrentUserId())) {
            throw new AccessDeniedException("Bu işlemi yalnızca kendi hesabın için yapabilirsin.");
        }
        return bookmarkService.getUserBookmarks(userId);
    }
}
