package com.concertly.backend.service;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;

/**
 * Etkinlik sayfası görüntülenmesi (organizatör paneli istatistiği).
 *
 * Her izleyici bir etkinliği bir kez saydırır: giriş yapmış kullanıcı "u:<id>", oturumsuz
 * cihaz "a:<IP+tarayıcı özeti>" anahtarıyla event_views'a yazılır; view_count yalnız yeni
 * satırda artar. Ham IP saklanmaz. Organizatörün kendi etkinliğine bakması sayılmaz.
 * Sayım hatası sayfayı asla bozmaz.
 */
@Service
public class EventViewService {

    private static final Logger log = LoggerFactory.getLogger(EventViewService.class);

    private final JdbcTemplate jdbc;

    public EventViewService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void record(Long eventId, Long userId, HttpServletRequest request) {
        try {
            if (userId != null && isOwnEvent(eventId, userId)) return;
            String key = viewerKey(userId, request);
            if (key == null) return;
            jdbc.update("""
                    WITH ins AS (
                        INSERT INTO event_views (event_id, viewer_key, created_at) VALUES (?, ?, now())
                        ON CONFLICT DO NOTHING
                        RETURNING 1
                    )
                    UPDATE events SET view_count = coalesce(view_count, 0) + 1
                    WHERE id = ? AND EXISTS (SELECT 1 FROM ins)
                    """, eventId, key, eventId);
        } catch (Exception e) {
            log.debug("Goruntulenme sayilamadi (#{}): {}", eventId, e.getMessage());
        }
    }

    private boolean isOwnEvent(Long eventId, Long userId) {
        List<Long> owners = jdbc.queryForList("""
                SELECT o.owner_user_id FROM events e JOIN organizers o ON o.id = e.organizer_id WHERE e.id = ?
                """, Long.class, eventId);
        return owners.contains(userId);
    }

    static String viewerKey(Long userId, HttpServletRequest request) {
        if (userId != null) return "u:" + userId;
        if (request == null) return null;
        // Render vb. vekil arkasında gerçek istemci X-Forwarded-For'un ilk değeridir
        String forwarded = request.getHeader("X-Forwarded-For");
        String ip = forwarded != null && !forwarded.isBlank() ? forwarded.split(",")[0].trim() : request.getRemoteAddr();
        String agent = request.getHeader("User-Agent");
        return "a:" + sha256(ip + "|" + (agent == null ? "" : agent)).substring(0, 40);
    }

    private static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            return Integer.toHexString(s.hashCode());
        }
    }
}
