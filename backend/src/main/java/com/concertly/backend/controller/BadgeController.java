package com.concertly.backend.controller;

import com.concertly.backend.dto.response.BadgeResponse;
import com.concertly.backend.service.BadgeService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class BadgeController {

    private final BadgeService badgeService;

    public BadgeController(BadgeService badgeService) {
        this.badgeService = badgeService;
    }

    @GetMapping("/users/{id}/badges")
    public List<BadgeResponse> getUserBadges(@PathVariable Long id) {
        return badgeService.getUserBadges(id);
    }

    @GetMapping("/users/{id}/badges/all")
    public List<BadgeResponse> getAllBadgesWithStatus(@PathVariable Long id) {
        return badgeService.getAllBadgesWithStatus(id);
    }

    @GetMapping("/badges")
    public List<BadgeResponse> getAllBadges() {
        return badgeService.getAllBadges();
    }
}
