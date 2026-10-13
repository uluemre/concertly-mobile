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
    private final com.concertly.backend.service.ModerationQueueService queueService;

    public AdminModerationController(AdminModerationService moderationService,
                                     com.concertly.backend.service.ModerationQueueService queueService) {
        this.moderationService = moderationService;
        this.queueService = queueService;
    }

    /** İçerik başına gruplanmış kuyruk. status: open|resolved, type: all|posts|comments|community|messages|users, sort: newest|most */
    @GetMapping("/queue")
    public Map<String, Object> queue(@RequestParam(defaultValue = "open") String status,
                                     @RequestParam(defaultValue = "all") String type,
                                     @RequestParam(defaultValue = "newest") String sort) {
        return queueService.queue(status, type, sort);
    }

    /** Gövde: { targetType, targetId, action, reason?, days? } — action: DISMISS|HIDE|HIDE_WARN|HIDE_BAN|WARN|BAN|UNHIDE */
    @PostMapping("/queue/action")
    public Map<String, Object> act(@RequestBody Map<String, Object> body, jakarta.servlet.http.HttpServletRequest request) {
        Integer days = null;
        Object d = body.get("days");
        if (d != null && !String.valueOf(d).isBlank()) {
            try {
                days = Integer.valueOf(String.valueOf(d).trim());
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("INVALID_DURATION");
            }
        }
        String detail = queueService.act(String.valueOf(body.get("targetType")),
                Long.valueOf(String.valueOf(body.get("targetId"))),
                String.valueOf(body.get("action")),
                body.get("reason") == null ? null : String.valueOf(body.get("reason")),
                days, com.concertly.backend.security.JwtUtil.getCurrentUserId(), adminName());
        request.setAttribute(com.concertly.backend.config.AdminAuditInterceptor.DETAIL, detail);
        return queueService.stats();
    }

    /** Gövde: { action: DISMISS|HIDE, targets: [{ targetType, targetId }] } */
    @PostMapping("/queue/bulk")
    @SuppressWarnings("unchecked")
    public Map<String, Object> bulk(@RequestBody Map<String, Object> body, jakarta.servlet.http.HttpServletRequest request) {
        String detail = queueService.bulk((List<Map<String, Object>>) body.get("targets"),
                String.valueOf(body.get("action")), adminName());
        request.setAttribute(com.concertly.backend.config.AdminAuditInterceptor.DETAIL, detail);
        return queueService.stats();
    }

    private static String adminName() {
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return null;
        String name = auth.getName();
        int colon = name.indexOf(':');
        return colon > 0 ? name.substring(colon + 1) : name;
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
