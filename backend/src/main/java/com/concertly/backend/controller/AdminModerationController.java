package com.concertly.backend.controller;

import com.concertly.backend.dto.response.ReportResponse;
import com.concertly.backend.service.AdminModerationService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Admin moderasyon paneli uçları. /api/admin/** zaten ROLE_ADMIN ile korunuyor.
 */
@RestController
@RequestMapping("/api/admin/moderation")
public class AdminModerationController {

    private final AdminModerationService moderationService;

    public AdminModerationController(AdminModerationService moderationService) {
        this.moderationService = moderationService;
    }

    /** Şikayet kuyruğu. ?resolved=true kapatılmışları da getirir. */
    @GetMapping("/reports")
    public List<ReportResponse> getReports(
            @RequestParam(name = "resolved", defaultValue = "false") boolean includeResolved) {
        return moderationService.getReports(includeResolved);
    }

    @PatchMapping("/reports/{id}/resolve")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resolveReport(@PathVariable Long id) {
        moderationService.resolveReport(id);
    }

    /** İçeriği akıştan kaldır (silmez). body: { targetType, targetId, hidden } */
    @PostMapping("/hide")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void hide(@RequestBody Map<String, Object> body) {
        String targetType = String.valueOf(body.get("targetType"));
        Long targetId = Long.valueOf(String.valueOf(body.get("targetId")));
        boolean hidden = !Boolean.FALSE.equals(body.get("hidden"));
        moderationService.setContentHidden(targetType, targetId, hidden);
    }
}
