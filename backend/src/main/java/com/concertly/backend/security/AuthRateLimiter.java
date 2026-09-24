package com.concertly.backend.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Giriş ve şifre sıfırlama uçları için basit, bellek içi istek sınırı
 * (sabit pencere). Tek sunucu örneği için yeterlidir; ek bağımlılık yoktur.
 *
 * Asıl koruma e-posta anahtarıdır: IP, Render/Cloudflare arkasında her zaman
 * güvenilir gelmeyebileceği için IP sınırları bilerek geniş tutulur.
 */
@Component
public class AuthRateLimiter {

    public static final String TOO_MANY = "TOO_MANY_REQUESTS";
    private static final int MAX_KEYS = 20_000;

    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    private static final class Window {
        final long start;
        int count;
        Window(long start) { this.start = start; }
    }

    /** Sınır aşılmadıysa sayar ve true döner. */
    public boolean tryAcquire(String key, int limit, Duration window) {
        long now = System.currentTimeMillis();
        long span = window.toMillis();
        if (windows.size() > MAX_KEYS) {
            windows.entrySet().removeIf(e -> now - e.getValue().start >= span);
        }
        Window w = windows.compute(key, (k, cur) -> (cur == null || now - cur.start >= span) ? new Window(now) : cur);
        synchronized (w) {
            if (w.count >= limit) return false;
            w.count++;
            return true;
        }
    }

    /** Sınır aşıldıysa 429 fırlatır. */
    public void check(String key, int limit, Duration window) {
        if (!tryAcquire(key, limit, window)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, TOO_MANY);
        }
    }

    public static String emailKey(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    /**
     * İstemci IP'si: Cloudflare'in yazdığı başlık (istemci taklit edemez), yoksa
     * X-Forwarded-For'un son elemanı (son vekilin gördüğü adres), yoksa bağlantı adresi.
     */
    public static String clientIp(HttpServletRequest request) {
        if (request == null) return "unknown";
        String cf = request.getHeader("CF-Connecting-IP");
        if (cf != null && !cf.isBlank()) return cf.trim();
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            String[] parts = xff.split(",");
            return parts[parts.length - 1].trim();
        }
        return request.getRemoteAddr();
    }
}
