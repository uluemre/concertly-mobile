package com.concertly.backend.controller;

import com.concertly.backend.dto.request.NotificationSettingsRequest;
import com.concertly.backend.dto.response.NotificationResponse;
import com.concertly.backend.dto.response.NotificationSettingsResponse;
import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.NotificationService;
import com.concertly.backend.service.PushTokenService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;
    private final PushTokenService pushTokenService;

    public NotificationController(NotificationService notificationService,
                                  PushTokenService pushTokenService) {
        this.notificationService = notificationService;
        this.pushTokenService = pushTokenService;
    }

    @GetMapping
    public List<NotificationResponse> getNotifications() {
        Long userId = JwtUtil.getCurrentUserId();
        return notificationService.getForUser(userId);
    }

    @GetMapping("/unread-count")
    public Map<String, Long> getUnreadCount() {
        Long userId = JwtUtil.getCurrentUserId();
        return Map.of("count", notificationService.getUnreadCount(userId));
    }

    @PatchMapping("/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markRead(@PathVariable Long id) {
        Long userId = JwtUtil.getCurrentUserId();
        notificationService.markRead(id, userId);
    }

    @PatchMapping("/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markAllRead() {
        Long userId = JwtUtil.getCurrentUserId();
        notificationService.markAllRead(userId);
    }

    // ── Silme (tekli / çoklu / tümü) ──────────────────────────────────────────
    // Bildirim gerçekten silinmez, kullanıcının listesinden kaldırılır.

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        notificationService.delete(JwtUtil.getCurrentUserId(), java.util.List.of(id));
    }

    /** Body: {"ids": [1, 2, 3]} — gruplanmış satırlar birden çok bildirimi birlikte siler. */
    @PostMapping("/delete")
    public Map<String, Integer> deleteMany(@RequestBody Map<String, java.util.List<Long>> body) {
        java.util.List<Long> ids = body == null ? null : body.get("ids");
        return Map.of("deleted", notificationService.delete(JwtUtil.getCurrentUserId(), ids));
    }

    @DeleteMapping
    public Map<String, Integer> deleteAll() {
        return Map.of("deleted", notificationService.deleteAll(JwtUtil.getCurrentUserId()));
    }

    // ── Bildirim tercihleri ───────────────────────────────────────────────────

    @GetMapping("/settings")
    public NotificationSettingsResponse getSettings() {
        return pushTokenService.getSettings(JwtUtil.getCurrentUserId());
    }

    @PutMapping("/settings")
    public NotificationSettingsResponse updateSettings(@RequestBody NotificationSettingsRequest request) {
        return pushTokenService.updateSettings(JwtUtil.getCurrentUserId(), request);
    }
}
