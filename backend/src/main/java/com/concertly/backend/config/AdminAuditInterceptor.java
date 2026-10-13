package com.concertly.backend.config;

import com.concertly.backend.service.AdminAuditService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * /api/admin/** altındaki başarılı her değişikliği (GET dışı, durum < 400) işlem kaydına yazar.
 * Controller ayrıntı eklemek isterse isteğe {@link #DETAIL} özniteliğini koyar
 * (ör. ayar ekranı "anahtar: eski → yeni" satırlarını).
 */
@Component
public class AdminAuditInterceptor implements HandlerInterceptor {

    public static final String DETAIL = "adminAuditDetail";

    private final AdminAuditService auditService;

    public AdminAuditInterceptor(AdminAuditService auditService) {
        this.auditService = auditService;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        String method = request.getMethod();
        if ("GET".equals(method) || "HEAD".equals(method) || "OPTIONS".equals(method)) return;
        int status = response.getStatus();
        if (ex != null || status >= 400) return;

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long adminId = null;
        String adminName = null;
        if (auth != null && auth.getName() != null) {
            // JwtFilter adı "id:kullanıcıadı" biçiminde koyar
            String name = auth.getName();
            int colon = name.indexOf(':');
            if (colon > 0) {
                try {
                    adminId = Long.parseLong(name.substring(0, colon));
                } catch (NumberFormatException ignored) {
                    // ad biçimi beklenenden farklıysa yalnız ad yazılır
                }
                adminName = name.substring(colon + 1);
            } else {
                adminName = name;
            }
        }
        Object detail = request.getAttribute(DETAIL);
        auditService.record(adminId, adminName, method, request.getRequestURI(), status,
                detail != null ? detail.toString() : null);
    }
}
