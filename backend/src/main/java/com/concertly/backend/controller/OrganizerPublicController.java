package com.concertly.backend.controller;

import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.OrganizerProfileService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Organizatörün herkese açık profili ve takip. Profil okuma girişsiz açıktır; takip giriş ister. */
@RestController
@RequestMapping("/api/organizers")
public class OrganizerPublicController {

    private final OrganizerProfileService profiles;

    public OrganizerPublicController(OrganizerProfileService profiles) {
        this.profiles = profiles;
    }

    @GetMapping("/{id}")
    public Map<String, Object> profile(@PathVariable Long id) {
        return profiles.publicProfile(id, JwtUtil.getCurrentUserId());
    }

    @PostMapping("/{id}/follow")
    public Map<String, Object> follow(@PathVariable Long id) {
        return profiles.follow(id, JwtUtil.getCurrentUserId(), true);
    }

    @DeleteMapping("/{id}/follow")
    public Map<String, Object> unfollow(@PathVariable Long id) {
        return profiles.follow(id, JwtUtil.getCurrentUserId(), false);
    }
}
