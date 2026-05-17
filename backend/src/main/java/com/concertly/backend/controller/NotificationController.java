package com.concertly.backend.controller;

import com.concertly.backend.dto.response.NotificationResponse;
import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.NotificationService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
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
}
