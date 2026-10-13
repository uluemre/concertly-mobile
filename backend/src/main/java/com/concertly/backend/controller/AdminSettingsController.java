package com.concertly.backend.controller;

import com.concertly.backend.config.AdminAuditInterceptor;
import com.concertly.backend.service.AdminAuditService;
import com.concertly.backend.service.AppSettingsService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Admin: uygulama ayarları ve işlem kaydı. /api/admin/** zaten ROLE_ADMIN ister. */
@RestController
@RequestMapping("/api/admin")
public class AdminSettingsController {

    private final AppSettingsService settings;
    private final AdminAuditService auditService;

    public AdminSettingsController(AppSettingsService settings, AdminAuditService auditService) {
        this.settings = settings;
        this.auditService = auditService;
    }

    @GetMapping("/settings")
    public List<AppSettingsService.AdminSetting> list() {
        return settings.adminList();
    }

    /** Gövde: { "anahtar": değer, ... }. Hepsi geçerliyse birlikte kaydedilir. */
    @PutMapping("/settings")
    public List<AppSettingsService.AdminSetting> update(@RequestBody Map<String, Object> changes, HttpServletRequest request) {
        List<String> diff = settings.update(changes, adminName());
        if (!diff.isEmpty()) request.setAttribute(AdminAuditInterceptor.DETAIL, String.join("\n", diff));
        return settings.adminList();
    }

    @GetMapping("/audit")
    public Map<String, Object> audit(@RequestParam(defaultValue = "0") int page,
                                     @RequestParam(defaultValue = "30") int size,
                                     @RequestParam(required = false) String area) {
        return auditService.list(page, size, area);
    }

    private static String adminName() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return null;
        String name = auth.getName();
        int colon = name.indexOf(':');
        return colon > 0 ? name.substring(colon + 1) : name;
    }
}
