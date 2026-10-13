package com.concertly.backend.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Admin ana sayfası (Shopify / Stripe paneli gibi): dönem karşılaştırmalı ana sayılar,
 * günlük seriler, bekleyen işler, şehir dağılımı, en popüler konser ve sanatçılar.
 *
 * "Aktif kullanıcı": dönem içinde gönderi/yorum/mesaj yazan, konsere katılım işaretleyen,
 * Konser Arkadaşı'nda kaydıran ya da etkinlik sayfası açan farklı kullanıcı sayısı
 * (giriş zamanı tutulmadığı için davranıştan sayılır).
 */
@Service
public class AdminDashboardService {

    /** Aktivite olayları: (kullanıcı, zaman). event_views'ta kullanıcı "u:<id>" anahtarındadır. */
    private static final String ACTIVITY = """
            SELECT user_id AS uid, created_at AS at FROM posts
            UNION ALL SELECT user_id, created_at FROM comments
            UNION ALL SELECT sender_id, created_at FROM messages
            UNION ALL SELECT user_id, created_at FROM event_attendances
            UNION ALL SELECT swiper_id, created_at FROM buddy_swipes
            UNION ALL SELECT CAST(substring(viewer_key FROM 3) AS BIGINT), created_at FROM event_views WHERE viewer_key LIKE 'u:%'
            """;

    private final JdbcTemplate jdbc;

    public AdminDashboardService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** days: 7 | 30 | 90 — seçili dönem ve bir önceki eşit dönem karşılaştırılır. */
    public Map<String, Object> dashboard(int requestedDays) {
        int days = requestedDays == 7 || requestedDays == 90 ? requestedDays : 30;
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime start = LocalDate.now().minusDays(days - 1L).atStartOfDay();
        LocalDateTime prevStart = start.minusDays(days);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("days", days);
        out.put("kpis", kpis(start, prevStart, now));
        out.put("series", series(start, days));
        out.put("pending", pending());
        out.put("cities", jdbc.queryForList("""
                SELECT coalesce(nullif(trim(city), ''), '—') AS city, count(*) AS users
                FROM users GROUP BY 1 ORDER BY 2 DESC LIMIT 8
                """));
        out.put("topEvents", jdbc.queryForList("""
                SELECT e.id, e.name, to_char(e.event_date, 'YYYY-MM-DD"T"HH24:MI:SS') AS "eventDate", v.city,
                       count(a.id) AS going, coalesce(e.view_count, 0) AS views
                FROM events e
                JOIN event_attendances a ON a.event_id = e.id AND a.status = 'GOING'
                LEFT JOIN venues v ON v.id = e.venue_id
                WHERE e.event_date >= now() AND e.is_approved AND e.delisted_reason IS NULL AND e.merged_into_event_id IS NULL
                GROUP BY e.id, v.city
                ORDER BY going DESC, views DESC
                LIMIT 5
                """));
        out.put("topArtists", jdbc.queryForList("""
                SELECT a.id, a.name, a.image_url AS "imageUrl", count(f.id) AS followers
                FROM artists a JOIN artist_follows f ON f.artist_id = a.id
                WHERE a.merged_into_artist_id IS NULL
                GROUP BY a.id ORDER BY followers DESC LIMIT 5
                """));
        return out;
    }

    private Map<String, Object> kpis(LocalDateTime start, LocalDateTime prevStart, LocalDateTime now) {
        Map<String, Object> k = new LinkedHashMap<>();
        k.put("totalUsers", jdbc.queryForObject("SELECT count(*) FROM users", Long.class));
        k.put("newUsers", pair("SELECT count(*) FROM users WHERE created_at >= ? AND created_at < ?", start, prevStart, now));
        k.put("activeUsers", pair("SELECT count(DISTINCT uid) FROM (" + ACTIVITY + ") x WHERE at >= ? AND at < ?", start, prevStart, now));
        k.put("posts", pair("SELECT count(*) FROM posts WHERE created_at >= ? AND created_at < ?", start, prevStart, now));
        k.put("messages", pair("SELECT count(*) FROM messages WHERE created_at >= ? AND created_at < ?", start, prevStart, now));
        k.put("going", pair("SELECT count(*) FROM event_attendances WHERE status = 'GOING' AND created_at >= ? AND created_at < ?", start, prevStart, now));
        // Eşleşme: karşılıklı beğenide ikinci beğeninin zamanı
        k.put("matches", pair("""
                SELECT count(*) FROM buddy_swipes a JOIN buddy_swipes b
                  ON b.swiper_id = a.target_id AND b.target_id = a.swiper_id AND b.liked AND a.liked
                WHERE a.swiper_id < a.target_id AND greatest(a.created_at, b.created_at) >= ? AND greatest(a.created_at, b.created_at) < ?
                """, start, prevStart, now));
        k.put("upcomingEvents", jdbc.queryForObject("""
                SELECT count(*) FROM events WHERE event_date >= now() AND is_approved AND delisted_reason IS NULL AND merged_into_event_id IS NULL
                """, Long.class));
        return k;
    }

    /** { value: bu dönem, previous: önceki eşit dönem } — sorgu iki zaman parametresi alır. */
    private Map<String, Object> pair(String sql, LocalDateTime start, LocalDateTime prevStart, LocalDateTime now) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("value", jdbc.queryForObject(sql, Long.class, start, now));
        m.put("previous", jdbc.queryForObject(sql, Long.class, prevStart, start));
        return m;
    }

    /** Günlük seriler: kayıt, aktif kullanıcı, gönderi (boş günler 0). Her kaynak bir kez gruplanır. */
    private List<Map<String, Object>> series(LocalDateTime start, int days) {
        java.sql.Timestamp from = java.sql.Timestamp.valueOf(start);
        return jdbc.queryForList("""
                WITH d AS (SELECT generate_series(?::date, current_date, interval '1 day')::date AS day),
                     s AS (SELECT created_at::date AS day, count(*) AS c FROM users WHERE created_at >= ? GROUP BY 1),
                     a AS (SELECT at::date AS day, count(DISTINCT uid) AS c FROM (%s) x WHERE at >= ? GROUP BY 1),
                     p AS (SELECT created_at::date AS day, count(*) AS c FROM posts WHERE created_at >= ? GROUP BY 1)
                SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
                       coalesce(s.c, 0) AS signups, coalesce(a.c, 0) AS active, coalesce(p.c, 0) AS posts
                FROM d LEFT JOIN s ON s.day = d.day LEFT JOIN a ON a.day = d.day LEFT JOIN p ON p.day = d.day
                ORDER BY d.day
                """.formatted(ACTIVITY), java.sql.Date.valueOf(start.toLocalDate()), from, from, from);
    }

    private Map<String, Object> pending() {
        return jdbc.queryForMap("""
                SELECT (SELECT count(*) FROM events WHERE NOT coalesce(is_approved, false) AND delisted_reason IS NULL
                          AND merged_into_event_id IS NULL AND event_date >= now()) AS events,
                       (SELECT count(DISTINCT (target_type, target_id)) FROM reports WHERE resolved IS NOT TRUE) AS reports,
                       (SELECT count(*) FROM organizer_requests WHERE status = 'PENDING') AS organizers,
                       (SELECT count(*) FROM communities WHERE approval_status = 'PENDING') AS communities,
                       (SELECT count(*) FROM event_claims WHERE status = 'PENDING') AS claims
                """);
    }
}
