package com.concertly.backend.controller;

import com.concertly.backend.dto.response.BadgeResponse;
import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.BadgeService;
import com.concertly.backend.service.ModerationService;
import com.concertly.backend.service.PrivacyService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class BadgeController {

    private final BadgeService badgeService;
    private final ModerationService moderationService;
    private final PrivacyService privacyService;

    public BadgeController(BadgeService badgeService,
                           ModerationService moderationService,
                           PrivacyService privacyService) {
        this.badgeService = badgeService;
        this.moderationService = moderationService;
        this.privacyService = privacyService;
    }

    /** Engel (404) + özel hesap (403 PRIVATE_ACCOUNT) — SEC-05; kendi rozetleri her zaman açık. */
    private void requireContentAccess(Long targetId) {
        Long viewerId = JwtUtil.getCurrentUserId();
        moderationService.requireVisible(viewerId, targetId);
        privacyService.requireCanViewContent(viewerId, targetId);
    }

    @GetMapping("/users/{id}/badges")
    public List<BadgeResponse> getUserBadges(@PathVariable Long id) {
        requireContentAccess(id);
        return badgeService.getUserBadges(id);
    }

    @GetMapping("/users/{id}/badges/all")
    public List<BadgeResponse> getAllBadgesWithStatus(@PathVariable Long id) {
        requireContentAccess(id);
        return badgeService.getAllBadgesWithStatus(id);
    }

    @GetMapping("/badges")
    public List<BadgeResponse> getAllBadges() {
        return badgeService.getAllBadges();
    }
}
