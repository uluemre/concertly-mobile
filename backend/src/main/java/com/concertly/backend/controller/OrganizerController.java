package com.concertly.backend.controller;

import com.concertly.backend.dto.response.OrganizerRequestResponse;
import com.concertly.backend.model.OrganizerRequest;
import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.OrganizerService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Organizatör/mekan/menajer hesabı başvurusu (kullanıcı tarafı). */
@RestController
@RequestMapping("/api/organizer")
public class OrganizerController {

    private final OrganizerService organizerService;

    public OrganizerController(OrganizerService organizerService) {
        this.organizerService = organizerService;
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
}
