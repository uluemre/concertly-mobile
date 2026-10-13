package com.concertly.backend.config;

import com.concertly.backend.service.AppSettingsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.List;

/**
 * Admin panelindeki bakım modu ve özellik anahtarlarını sunucuda uygular.
 *
 * Uygulama kapalı özelliğin girişlerini zaten gizler; bu katman eski sürümleri ve doğrudan
 * API çağrılarını durdurur. Adminler hiçbir kurala takılmaz (bakımda uygulamayı deneyebilsin).
 * Hata kodları: 503 MAINTENANCE, 403 FEATURE_DISABLED, 403 REGISTRATION_CLOSED.
 */
@Component
public class FeatureGateInterceptor implements HandlerInterceptor {

    private static final AntPathMatcher PATHS = new AntPathMatcher();

    /** Bakımda da açık kalanlar: ayarların okunması ve adminin giriş yapabilmesi. */
    private static final List<String> MAINTENANCE_OPEN = List.of(
            "/api/app/config", "/api/auth/login", "/api/auth/refresh", "/api/auth/logout", "/api/admin/**");

    private static final List<String> BUDDY = List.of("/api/buddy/**", "/api/events/*/buddies/**", "/api/events/*/buddies");
    private static final List<String> GAMES = List.of("/api/quiz/**", "/api/daily-song/**", "/api/bingo/**", "/api/setlist/**");
    private static final List<String> COMMUNITIES = List.of("/api/communities", "/api/communities/**");
    private static final List<String> POSTING = List.of(
            "/api/posts", "/api/posts/*/comments", "/api/communities/*/posts", "/api/communities/*/posts/*/comments");
    private static final List<String> REGISTER = List.of("/api/auth/register", "/api/users/register");

    private final AppSettingsService settings;

    public FeatureGateInterceptor(AppSettingsService settings) {
        this.settings = settings;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if ("OPTIONS".equals(request.getMethod()) || isAdmin()) return true;
        check(request.getMethod(), request.getRequestURI());
        return true;
    }

    /** Kural ihlalinde ResponseStatusException fırlatır (GlobalExceptionHandler JSON'a çevirir). */
    void check(String method, String path) {
        if (settings.isOn(AppSettingsService.MAINTENANCE) && !matches(MAINTENANCE_OPEN, path)) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "MAINTENANCE");
        }
        if ("POST".equals(method) && matches(REGISTER, path) && !settings.isOn(AppSettingsService.FEATURE_REGISTRATION)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "REGISTRATION_CLOSED");
        }
        if (off(AppSettingsService.FEATURE_BUDDY) && matches(BUDDY, path)) throw disabled();
        if (off(AppSettingsService.FEATURE_GAMES) && matches(GAMES, path)) throw disabled();
        if (off(AppSettingsService.FEATURE_COMMUNITIES) && matches(COMMUNITIES, path)) throw disabled();
        if (off(AppSettingsService.FEATURE_POSTING) && "POST".equals(method) && matches(POSTING, path)) throw disabled();
        if (off(AppSettingsService.FEATURE_EVENT_SUGGESTIONS) && "POST".equals(method)
                && "/api/events/suggest".equals(path)) {
            throw disabled();
        }
    }

    private boolean off(String key) {
        return !settings.isOn(key);
    }

    private static boolean matches(List<String> patterns, String path) {
        for (String p : patterns) {
            if (PATHS.match(p, path)) return true;
        }
        return false;
    }

    private static ResponseStatusException disabled() {
        return new ResponseStatusException(HttpStatus.FORBIDDEN, "FEATURE_DISABLED");
    }

    private static boolean isAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    }
}
