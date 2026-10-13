package com.concertly.backend.controller;

import com.concertly.backend.config.AdminAuditInterceptor;
import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.AdminUserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Admin kullanıcı yönetimi: arama, genel bakış, süreli yasak, uyarı, iç not, rozet.
 * /api/admin/** ROLE_ADMIN ile korunuyor. Her işlem işlem kaydına gerekçesiyle düşer.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminUserController {

    private final AdminUserService users;

    public AdminUserController(AdminUserService users) {
        this.users = users;
    }

    /** filter: all | active | banned | admin | reported | new */
    @GetMapping("/users/search")
    public List<Map<String, Object>> search(@RequestParam(required = false) String q,
                                            @RequestParam(defaultValue = "all") String filter,
                                            @RequestParam(defaultValue = "0") int page) {
        return users.search(q, filter, page);
    }

    @GetMapping("/users/{id}/overview")
    public Map<String, Object> overview(@PathVariable Long id) {
        return users.overview(id);
    }

    /** Gövde: { reason, days? } — days boş ya da 0 ise süresiz. */
    @PostMapping("/users/{id}/suspend")
    public Map<String, Object> suspend(@PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        Integer days;
        try {
            days = body.get("days") == null || String.valueOf(body.get("days")).isBlank()
                    ? null : Integer.valueOf(String.valueOf(body.get("days")).trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("INVALID_DURATION");
        }
        audit(request, users.ban(id, str(body.get("reason")), days, JwtUtil.getCurrentUserId(), adminName()));
        return users.overview(id);
    }

    @PostMapping("/users/{id}/reinstate")
    public Map<String, Object> reinstate(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> body,
                                         HttpServletRequest request) {
        audit(request, users.unban(id, body == null ? null : str(body.get("reason")), adminName()));
        return users.overview(id);
    }

    @PostMapping("/users/{id}/warn")
    public Map<String, Object> warn(@PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        audit(request, users.warn(id, str(body.get("reason")), adminName()));
        return users.overview(id);
    }

    @PostMapping("/users/{id}/notes")
    public Map<String, Object> note(@PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        audit(request, users.note(id, str(body.get("text")), adminName()));
        return users.overview(id);
    }

    @GetMapping("/badges")
    public List<Map<String, Object>> badges() {
        return users.allBadges();
    }

    @PostMapping("/users/{id}/badges/{code}")
    public Map<String, Object> grantBadge(@PathVariable Long id, @PathVariable String code, HttpServletRequest request) {
        audit(request, users.grantBadge(id, code));
        return users.overview(id);
    }

    @DeleteMapping("/users/{id}/badges/{code}")
    public Map<String, Object> revokeBadge(@PathVariable Long id, @PathVariable String code, HttpServletRequest request) {
        audit(request, users.revokeBadge(id, code));
        return users.overview(id);
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private static void audit(HttpServletRequest request, String detail) {
        if (detail != null) request.setAttribute(AdminAuditInterceptor.DETAIL, detail);
    }

    private static String adminName() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return null;
        String name = auth.getName();
        int colon = name.indexOf(':');
        return colon > 0 ? name.substring(colon + 1) : name;
    }
}
