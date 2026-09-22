package com.concertly.backend.controller;

import com.concertly.backend.dto.response.OrganizerRequestResponse;
import com.concertly.backend.service.OrganizerService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Organizatör başvuru kuyruğu (admin). /api/admin/** ROLE_ADMIN ile korunuyor. */
@RestController
@RequestMapping("/api/admin/organizer-requests")
public class AdminOrganizerController {

    private final OrganizerService organizerService;

    public AdminOrganizerController(OrganizerService organizerService) {
        this.organizerService = organizerService;
    }

    @GetMapping
    public List<OrganizerRequestResponse> pending() {
        return organizerService.pending();
    }

    @PostMapping("/{id}/approve")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void approve(@PathVariable Long id) {
        organizerService.approve(id);
    }

    @PostMapping("/{id}/reject")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reject(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body) {
        organizerService.reject(id, body == null ? null : body.get("note"));
    }
}
