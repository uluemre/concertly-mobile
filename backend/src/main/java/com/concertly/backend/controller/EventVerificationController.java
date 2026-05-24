package com.concertly.backend.controller;

import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.EventVerificationService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/events/{eventId}/verify")
public class EventVerificationController {

    private final EventVerificationService verificationService;

    public EventVerificationController(EventVerificationService verificationService) {
        this.verificationService = verificationService;
    }

    @GetMapping
    public Map<String, Object> getStatus(@PathVariable Long eventId) {
        Long userId = JwtUtil.getCurrentUserId();
        return verificationService.getStatus(userId, eventId);
    }

    @PostMapping
    public Map<String, Object> verify(@PathVariable Long eventId) {
        Long userId = JwtUtil.getCurrentUserId();
        return verificationService.verify(userId, eventId);
    }
}
