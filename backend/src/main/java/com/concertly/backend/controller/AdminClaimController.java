package com.concertly.backend.controller;

import com.concertly.backend.config.AdminAuditInterceptor;
import com.concertly.backend.service.EventClaimService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Admin: "bu etkinlik benim" talepleri. /api/admin/** ROLE_ADMIN ile korunuyor. */
@RestController
@RequestMapping("/api/admin/claims")
public class AdminClaimController {

    private final EventClaimService claims;

    public AdminClaimController(EventClaimService claims) {
        this.claims = claims;
    }

    /** status: PENDING (varsayılan) | APPROVED | REJECTED | ALL */
    @GetMapping
    public List<Map<String, Object>> list(@RequestParam(required = false) String status) {
        return claims.adminList(status);
    }

    @PostMapping("/{id}/approve")
    public Map<String, Object> approve(@PathVariable Long id, HttpServletRequest request) {
        request.setAttribute(AdminAuditInterceptor.DETAIL, claims.approve(id, adminName()));
        return Map.of("ok", true);
    }

    @PostMapping("/{id}/reject")
    public Map<String, Object> reject(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body,
                                      HttpServletRequest request) {
        request.setAttribute(AdminAuditInterceptor.DETAIL, claims.reject(id, body == null ? null : body.get("note"), adminName()));
        return Map.of("ok", true);
    }

    private static String adminName() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return null;
        String name = auth.getName();
        int colon = name.indexOf(':');
        return colon > 0 ? name.substring(colon + 1) : name;
    }
}
