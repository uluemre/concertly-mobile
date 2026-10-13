package com.concertly.backend.controller;

import com.concertly.backend.config.AdminAuditInterceptor;
import com.concertly.backend.service.AdminOrganizerService;
import com.concertly.backend.service.OrganizerService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Admin organizatör yönetimi: başvuru incelemesi (güven sinyalleri, iç not, onay/ret)
 * ve onaylı organizatörler (askıya alma, duyuru yetkisi, doğrulama rozeti).
 * /api/admin/** ROLE_ADMIN ile korunuyor.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminOrganizerController {

    private final OrganizerService organizerService;
    private final AdminOrganizerService adminOrganizerService;

    public AdminOrganizerController(OrganizerService organizerService, AdminOrganizerService adminOrganizerService) {
        this.organizerService = organizerService;
        this.adminOrganizerService = adminOrganizerService;
    }

    // ── Başvurular ────────────────────────────────────────────────────────────

    /** status: PENDING (varsayılan) | APPROVED | REJECTED | ALL */
    @GetMapping("/organizer-requests")
    public List<Map<String, Object>> requests(@RequestParam(required = false) String status) {
        return adminOrganizerService.requests(status);
    }

    @GetMapping("/organizer-requests/{id}")
    public Map<String, Object> request(@PathVariable Long id) {
        return adminOrganizerService.request(id);
    }

    @PutMapping("/organizer-requests/{id}/note")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void note(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body) {
        adminOrganizerService.setInternalNote(id, body == null ? null : body.get("note"));
    }

    @PostMapping("/organizer-requests/{id}/approve")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void approve(@PathVariable Long id) {
        organizerService.approve(id, adminName());
    }

    @PostMapping("/organizer-requests/{id}/reject")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reject(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body,
                       HttpServletRequest request) {
        String note = body == null ? null : body.get("note");
        organizerService.reject(id, note, adminName());
        if (note != null && !note.isBlank()) request.setAttribute(AdminAuditInterceptor.DETAIL, "note: " + note);
    }

    // ── Onaylı organizatörler ────────────────────────────────────────────────

    @GetMapping("/organizers")
    public List<Map<String, Object>> organizers(@RequestParam(required = false) String q) {
        return adminOrganizerService.organizers(q);
    }

    @GetMapping("/organizers/{id}")
    public Map<String, Object> organizer(@PathVariable Long id) {
        return adminOrganizerService.organizer(id);
    }

    /** Gövde: { active?, canAnnounce?, verified?, name? } */
    @PatchMapping("/organizers/{id}")
    public Map<String, Object> update(@PathVariable Long id, @RequestBody Map<String, Object> body,
                                      HttpServletRequest request) {
        List<String> diff = adminOrganizerService.update(id, body);
        if (!diff.isEmpty()) request.setAttribute(AdminAuditInterceptor.DETAIL, String.join("\n", diff));
        return adminOrganizerService.organizer(id);
    }

    private static String adminName() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return null;
        String name = auth.getName();
        int colon = name.indexOf(':');
        return colon > 0 ? name.substring(colon + 1) : name;
    }
}
