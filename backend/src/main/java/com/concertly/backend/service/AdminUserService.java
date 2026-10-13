package com.concertly.backend.service;

import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Badge;
import com.concertly.backend.model.User;
import com.concertly.backend.model.UserSanction;
import com.concertly.backend.repository.BadgeRepository;
import com.concertly.backend.repository.SearchText;
import com.concertly.backend.repository.UserBadgeRepository;
import com.concertly.backend.repository.UserRepository;
import com.concertly.backend.repository.UserSanctionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Admin kullanıcı yönetimi (Discord / Reddit moderatör araçları gibi): tek ekranda kullanıcının
 * profili, sayıları, hakkındaki şikâyetler, son içerikleri ve moderasyon geçmişi; süreli yasak,
 * uyarı, iç not ve rozet. Süreli yasaklar süre dolunca otomatik kalkar.
 */
@Service
public class AdminUserService {

    private static final Logger log = LoggerFactory.getLogger(AdminUserService.class);
    private static final String DATE = "to_char(%s, 'YYYY-MM-DD\"T\"HH24:MI:SS')";
    private static final int PAGE_SIZE = 40;

    /** Kullanıcı hakkındaki şikâyetler: profili, gönderileri ve yorumları (r = reports). */
    private static final String REPORTS_AGAINST = """
            ((r.target_type = 'USER' AND r.target_id = %1$s)
              OR (r.target_type = 'POST' AND r.target_id IN (SELECT id FROM posts WHERE user_id = %1$s))
              OR (r.target_type = 'COMMENT' AND r.target_id IN (SELECT id FROM comments WHERE user_id = %1$s)))
            """;

    private final JdbcTemplate jdbc;
    private final UserRepository userRepository;
    private final UserSanctionRepository sanctionRepository;
    private final BadgeRepository badgeRepository;
    private final UserBadgeRepository userBadgeRepository;
    private final RefreshTokenService refreshTokenService;
    private final NotificationService notificationService;

    public AdminUserService(JdbcTemplate jdbc,
                            UserRepository userRepository,
                            UserSanctionRepository sanctionRepository,
                            BadgeRepository badgeRepository,
                            UserBadgeRepository userBadgeRepository,
                            RefreshTokenService refreshTokenService,
                            NotificationService notificationService) {
        this.jdbc = jdbc;
        this.userRepository = userRepository;
        this.sanctionRepository = sanctionRepository;
        this.badgeRepository = badgeRepository;
        this.userBadgeRepository = userBadgeRepository;
        this.refreshTokenService = refreshTokenService;
        this.notificationService = notificationService;
    }

    // ── Liste ─────────────────────────────────────────────────────────────────

    /** filter: all | active | banned | admin | reported | new (7 gün); q: kullanıcı adı, ad ya da e-posta. */
    public List<Map<String, Object>> search(String q, String filter, int page) {
        List<Object> args = new ArrayList<>();
        List<String> where = new ArrayList<>();
        if (q != null && !q.isBlank()) {
            String fold = "lower(translate(coalesce(%s, ''), '" + SearchText.FOLD_FROM + "', '" + SearchText.FOLD_TO + "'))";
            where.add("(" + fold.formatted("u.username") + " LIKE ? ESCAPE '!' OR " + fold.formatted("u.full_name")
                    + " LIKE ? ESCAPE '!' OR " + fold.formatted("u.email") + " LIKE ? ESCAPE '!')");
            String p = SearchText.containsPattern(q.trim());
            args.add(p);
            args.add(p);
            args.add(p);
        }
        String reportsCount = "(SELECT count(*) FROM reports r WHERE r.resolved IS NOT TRUE AND " + REPORTS_AGAINST.formatted("u.id") + ")";
        switch (filter == null ? "all" : filter) {
            case "active" -> where.add("coalesce(u.is_active, true)");
            case "banned" -> where.add("u.is_active = false");
            case "admin" -> where.add("EXISTS (SELECT 1 FROM user_roles ur JOIN roles ro ON ro.id = ur.role_id WHERE ur.user_id = u.id AND ro.name = 'ROLE_ADMIN')");
            case "reported" -> where.add(reportsCount + " > 0");
            case "new" -> where.add("u.created_at > now() - interval '7 days'");
            default -> { }
        }
        args.add(PAGE_SIZE);
        args.add(Math.max(page, 0) * PAGE_SIZE);
        return jdbc.queryForList("""
                SELECT u.id, u.username, u.full_name AS "fullName", u.email, u.city,
                       u.profile_image_url AS "profileImageUrl", coalesce(u.is_active, true) AS "isActive",
                       %s AS "bannedUntil", %s AS "createdAt",
                       EXISTS (SELECT 1 FROM user_roles ur JOIN roles ro ON ro.id = ur.role_id
                               WHERE ur.user_id = u.id AND ro.name = 'ROLE_ADMIN') AS "isAdmin",
                       %s AS "openReports"
                FROM users u
                %s
                ORDER BY %s
                LIMIT ? OFFSET ?
                """.formatted(DATE.formatted("u.banned_until"), DATE.formatted("u.created_at"), reportsCount,
                where.isEmpty() ? "" : "WHERE " + String.join(" AND ", where),
                "reported".equals(filter) ? "\"openReports\" DESC, u.id DESC" : "u.created_at DESC NULLS LAST, u.id DESC"),
                args.toArray());
    }

    // ── Genel bakış ───────────────────────────────────────────────────────────

    public Map<String, Object> overview(Long userId) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT u.id, u.username, u.full_name AS "fullName", u.email, u.city, u.bio,
                       u.profile_image_url AS "profileImageUrl", %s AS "createdAt",
                       coalesce(u.email_verified, false) AS "emailVerified", coalesce(u.is_active, true) AS "isActive",
                       %s AS "bannedUntil", coalesce(u.private_account, false) AS "privateAccount",
                       u.message_privacy AS "messagePrivacy",
                       CASE WHEN u.birth_date IS NULL THEN NULL ELSE date_part('year', age(u.birth_date))::int END AS age,
                       EXISTS (SELECT 1 FROM user_roles ur JOIN roles ro ON ro.id = ur.role_id
                               WHERE ur.user_id = u.id AND ro.name = 'ROLE_ADMIN') AS "isAdmin",
                       (SELECT o.name FROM organizers o WHERE o.owner_user_id = u.id) AS "organizerName",
                       (SELECT count(*) FROM follows f WHERE f.following_id = u.id AND (f.status IS NULL OR f.status = 'ACCEPTED')) AS followers,
                       (SELECT count(*) FROM follows f WHERE f.follower_id = u.id AND (f.status IS NULL OR f.status = 'ACCEPTED')) AS following,
                       (SELECT count(*) FROM posts p WHERE p.user_id = u.id) AS posts,
                       (SELECT count(*) FROM comments c WHERE c.user_id = u.id) AS comments,
                       (SELECT count(*) FROM event_attendances a WHERE a.user_id = u.id AND a.status = 'GOING') AS going,
                       (SELECT count(*) FROM event_attendances a WHERE a.user_id = u.id AND a.status = 'WENT') AS went,
                       (SELECT count(*) FROM community_members m WHERE m.user_id = u.id AND m.status = 'ACTIVE') AS communities,
                       (SELECT count(*) FROM messages m WHERE m.sender_id = u.id) AS "messagesSent",
                       (SELECT count(*) FROM reports r WHERE r.reporter_id = u.id) AS "reportsFiled",
                       (SELECT count(*) FROM reports r WHERE %s) AS "reportsAgainst",
                       (SELECT count(*) FROM blocks b WHERE b.blocked_id = u.id) AS "blockedBy"
                FROM users u WHERE u.id = ?
                """.formatted(DATE.formatted("u.created_at"), DATE.formatted("u.banned_until"), REPORTS_AGAINST.formatted("u.id")),
                userId);
        if (rows.isEmpty()) throw new ResourceNotFoundException("USER_NOT_FOUND");
        Map<String, Object> out = new LinkedHashMap<>(rows.get(0));

        out.put("reports", jdbc.queryForList("""
                SELECT r.id, r.reason, r.target_type AS "targetType", r.target_id AS "targetId",
                       coalesce(r.resolved, false) AS resolved, %s AS "createdAt", ru.username AS "reporter"
                FROM reports r LEFT JOIN users ru ON ru.id = r.reporter_id
                WHERE %s
                ORDER BY r.created_at DESC LIMIT 30
                """.formatted(DATE.formatted("r.created_at"), REPORTS_AGAINST.formatted("?")), userId, userId, userId));
        // "posts" sayıdır (yukarıda); liste ayrı adla döner, aksi hâlde sayıyı ezer
        out.put("recentPosts", jdbc.queryForList("""
                SELECT p.id, p.content, p.image_url AS "imageUrl", coalesce(p.is_hidden, false) AS hidden, %s AS "createdAt",
                       (SELECT count(*) FROM likes l WHERE l.post_id = p.id) AS likes,
                       (SELECT count(*) FROM comments c WHERE c.post_id = p.id) AS comments
                FROM posts p WHERE p.user_id = ? ORDER BY p.created_at DESC LIMIT 15
                """.formatted(DATE.formatted("p.created_at")), userId));
        out.put("recentComments", jdbc.queryForList("""
                SELECT c.id, c.content, c.post_id AS "postId", coalesce(c.is_hidden, false) AS hidden, %s AS "createdAt"
                FROM comments c WHERE c.user_id = ? ORDER BY c.created_at DESC LIMIT 15
                """.formatted(DATE.formatted("c.created_at")), userId));
        out.put("badges", jdbc.queryForList("""
                SELECT b.code, b.name, b.icon, %s AS "earnedAt"
                FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
                WHERE ub.user_id = ? ORDER BY ub.earned_at DESC
                """.formatted(DATE.formatted("ub.earned_at")), userId));
        out.put("history", sanctionRepository.findByUserIdOrderByCreatedAtDesc(userId).stream().map(s -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", s.getId());
            m.put("type", s.getType().name());
            m.put("reason", s.getReason());
            m.put("untilAt", s.getUntilAt());
            m.put("adminName", s.getAdminName());
            m.put("createdAt", s.getCreatedAt());
            return m;
        }).toList());
        return out;
    }

    public List<Map<String, Object>> allBadges() {
        return jdbc.queryForList("SELECT code, name, icon, description FROM badges ORDER BY name");
    }

    // ── İşlemler ──────────────────────────────────────────────────────────────

    /** days null ya da 0 → süresiz. Adminler ve kişinin kendisi yasaklanamaz. */
    @Transactional
    public String ban(Long userId, String reason, Integer days, Long adminId, String adminName) {
        User user = load(userId);
        if (Objects.equals(userId, adminId)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CANNOT_BAN_SELF");
        if (isAdmin(user)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CANNOT_BAN_ADMIN");
        if (days != null && (days < 0 || days > 365)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_DURATION");
        String why = reasonOf(reason, true);
        LocalDateTime until = days == null || days == 0 ? null : LocalDateTime.now().plusDays(days);
        user.setIsActive(false);
        user.setBannedUntil(until);
        userRepository.save(user);
        // Açık oturumlar hemen kapanır (erişim belirteci JwtFilter'da da reddedilir)
        refreshTokenService.deleteByUser(user);
        sanctionRepository.save(new UserSanction(userId, UserSanction.Type.BAN, why, until, adminName));
        return "ban" + (until == null ? " (süresiz)" : " (" + days + " gün)") + ": " + why;
    }

    @Transactional
    public String unban(Long userId, String reason, String adminName) {
        User user = load(userId);
        if (!Boolean.FALSE.equals(user.getIsActive())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "NOT_BANNED");
        user.setIsActive(true);
        user.setBannedUntil(null);
        userRepository.save(user);
        String why = reasonOf(reason, false);
        sanctionRepository.save(new UserSanction(userId, UserSanction.Type.UNBAN, why, null, adminName));
        return "unban" + (why == null ? "" : ": " + why);
    }

    /** Uyarı kullanıcıya bildirim olarak gider (gerekçe zorunlu). */
    @Transactional
    public String warn(Long userId, String reason, String adminName) {
        load(userId);
        String why = reasonOf(reason, true);
        UserSanction s = sanctionRepository.save(new UserSanction(userId, UserSanction.Type.WARN, why, null, adminName));
        notificationService.sendSystem(userId, "admin_warning", "user", s.getId(), why);
        return "warn: " + why;
    }

    @Transactional
    public String note(Long userId, String text, String adminName) {
        load(userId);
        String why = reasonOf(text, true);
        sanctionRepository.save(new UserSanction(userId, UserSanction.Type.NOTE, why, null, adminName));
        return "note: " + why;
    }

    @Transactional
    public String grantBadge(Long userId, String code) {
        load(userId);
        Badge badge = badgeRepository.findByCode(code).orElseThrow(() -> new ResourceNotFoundException("BADGE_NOT_FOUND"));
        if (userBadgeRepository.insertIfAbsent(userId, badge.getId(), LocalDateTime.now()) > 0) {
            // Kullanıcı rozet bildirimini alır (mesaj alanı rozet kodu; uygulama adı dile göre çevirir)
            notificationService.sendSystem(userId, "badge", "badge", badge.getId(), badge.getCode());
        }
        return "badge+ " + code;
    }

    @Transactional
    public String revokeBadge(Long userId, String code) {
        int n = jdbc.update("DELETE FROM user_badges WHERE user_id = ? AND badge_id = (SELECT id FROM badges WHERE code = ?)", userId, code);
        if (n == 0) throw new ResourceNotFoundException("BADGE_NOT_FOUND");
        return "badge- " + code;
    }

    /** Süresi dolan yasaklar otomatik kalkar (10 dakikada bir). */
    @Scheduled(fixedDelayString = "${app.moderation.ban-expiry-check-ms:600000}", initialDelay = 60000)
    @Transactional
    public void expireBans() {
        try {
            List<Long> ids = jdbc.queryForList(
                    "SELECT id FROM users WHERE is_active = false AND banned_until IS NOT NULL AND banned_until <= now()", Long.class);
            for (Long id : ids) {
                jdbc.update("UPDATE users SET is_active = true, banned_until = NULL WHERE id = ?", id);
                sanctionRepository.save(new UserSanction(id, UserSanction.Type.UNBAN, "Süre doldu", null, "system"));
            }
            if (!ids.isEmpty()) log.info("Suresi dolan {} yasak kaldirildi", ids.size());
        } catch (Exception e) {
            log.warn("Yasak suresi kontrolu yapilamadi: {}", e.getMessage());
        }
    }

    // ── Yardımcılar ──────────────────────────────────────────────────────────

    private User load(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new ResourceNotFoundException("USER_NOT_FOUND"));
    }

    private static boolean isAdmin(User user) {
        return user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "ROLE_ADMIN".equals(r.getName()));
    }

    static String reasonOf(String raw, boolean required) {
        String s = raw == null ? "" : raw.trim();
        if (s.isEmpty()) {
            if (required) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "REASON_REQUIRED");
            return null;
        }
        if (s.length() > 500) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "REASON_TOO_LONG");
        return s;
    }
}
