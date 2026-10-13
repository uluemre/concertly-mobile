package com.concertly.backend.service;

import com.concertly.backend.model.*;
import com.concertly.backend.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Moderasyon kuyruğu (Instagram / TikTok inceleme kuyruğu gibi).
 *
 * Aynı içeriğe gelen şikâyetler tek kartta toplanır: kaç kişi, hangi gerekçeler, içeriğin
 * önizlemesi ve içerik sahibinin geçmişi. Tek kararla o içeriğe ait bütün açık şikâyetler
 * kapanır; karar (ve gerekiyorsa uyarı/yasak) kullanıcı yönetimiyle aynı kayda düşer.
 */
@Service
public class ModerationQueueService {

    public static final Set<String> ACTIONS = Set.of("DISMISS", "HIDE", "HIDE_WARN", "HIDE_BAN", "WARN", "BAN", "UNHIDE");
    private static final Set<String> HIDEABLE = Set.of("POST", "COMMENT", "COMMUNITY_POST", "COMMUNITY_COMMENT");
    private static final int MAX_GROUPS = 100;
    private static final int PREVIEW = 400;

    private final ReportRepository reportRepository;
    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final CommunityPostRepository communityPostRepository;
    private final CommunityPostCommentRepository communityPostCommentRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final AdminModerationService moderationService;
    private final AdminUserService adminUserService;
    private final JdbcTemplate jdbc;

    public ModerationQueueService(ReportRepository reportRepository,
                                  PostRepository postRepository,
                                  CommentRepository commentRepository,
                                  CommunityPostRepository communityPostRepository,
                                  CommunityPostCommentRepository communityPostCommentRepository,
                                  MessageRepository messageRepository,
                                  UserRepository userRepository,
                                  AdminModerationService moderationService,
                                  AdminUserService adminUserService,
                                  JdbcTemplate jdbc) {
        this.reportRepository = reportRepository;
        this.postRepository = postRepository;
        this.commentRepository = commentRepository;
        this.communityPostRepository = communityPostRepository;
        this.communityPostCommentRepository = communityPostCommentRepository;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.moderationService = moderationService;
        this.adminUserService = adminUserService;
        this.jdbc = jdbc;
    }

    // ── Kuyruk ────────────────────────────────────────────────────────────────

    /**
     * status: open | resolved; type: all | posts | comments | community | messages | users;
     * sort: newest | most (en çok şikâyet alan önce).
     */
    @Transactional(readOnly = true)
    public Map<String, Object> queue(String status, String type, String sort) {
        boolean resolved = "resolved".equals(status);
        List<Report> reports = resolved
                ? reportRepository.findTop500ByResolvedTrueOrderByCreatedAtDesc()
                : reportRepository.findByResolvedFalseOrderByCreatedAtDesc();
        Set<String> types = typesOf(type);

        Map<String, List<Report>> groups = new LinkedHashMap<>();
        for (Report r : reports) {
            String t = norm(r.getTargetType());
            if (types != null && !types.contains(t)) continue;
            groups.computeIfAbsent(t + ":" + r.getTargetId(), k -> new ArrayList<>()).add(r);
        }

        List<Map<String, Object>> cards = new ArrayList<>();
        for (List<Report> g : groups.values()) cards.add(card(g));
        Comparator<Map<String, Object>> byLast = Comparator.comparing(m -> (LocalDateTime) m.get("lastAt"));
        if ("most".equals(sort)) {
            cards.sort(Comparator.<Map<String, Object>>comparingInt(m -> (int) m.get("count")).reversed().thenComparing(byLast.reversed()));
        } else {
            cards.sort(byLast.reversed());
        }
        List<Map<String, Object>> page = cards.size() > MAX_GROUPS ? cards.subList(0, MAX_GROUPS) : cards;
        page.forEach(this::enrich);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("stats", stats());
        out.put("items", page);
        out.put("total", cards.size());
        return out;
    }

    public Map<String, Object> stats() {
        LocalDateTime today = LocalDate.now().atStartOfDay();
        return jdbc.queryForMap("""
                SELECT count(*) FILTER (WHERE resolved IS NOT TRUE) AS "openReports",
                       count(DISTINCT (target_type, target_id)) FILTER (WHERE resolved IS NOT TRUE) AS "openItems",
                       count(*) FILTER (WHERE created_at >= ?) AS "newToday",
                       count(*) FILTER (WHERE resolved AND resolved_at >= ?) AS "resolvedToday"
                FROM reports
                """, today, today);
    }

    private Map<String, Object> card(List<Report> g) {
        Report first = g.get(0);
        Map<String, Integer> reasons = new LinkedHashMap<>();
        List<String> reporters = new ArrayList<>();
        LocalDateTime firstAt = null, lastAt = null;
        for (Report r : g) {
            reasons.merge(r.getReason() == null ? "OTHER" : r.getReason(), 1, Integer::sum);
            if (r.getReporter() != null && reporters.size() < 5 && !reporters.contains(r.getReporter().getUsername())) {
                reporters.add(r.getReporter().getUsername());
            }
            if (r.getCreatedAt() != null) {
                if (firstAt == null || r.getCreatedAt().isBefore(firstAt)) firstAt = r.getCreatedAt();
                if (lastAt == null || r.getCreatedAt().isAfter(lastAt)) lastAt = r.getCreatedAt();
            }
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("targetType", norm(first.getTargetType()));
        m.put("targetId", first.getTargetId());
        m.put("count", g.size());
        m.put("reasons", reasons);
        m.put("reporters", reporters);
        m.put("firstAt", firstAt);
        m.put("lastAt", lastAt == null ? LocalDateTime.MIN : lastAt);
        m.put("resolution", first.getResolution());
        m.put("resolvedBy", first.getResolvedBy());
        m.put("resolvedAt", first.getResolvedAt());
        return m;
    }

    /** İçerik önizlemesi, bağlam ve içerik sahibinin sinyalleri. */
    private void enrich(Map<String, Object> m) {
        String type = (String) m.get("targetType");
        Long id = (Long) m.get("targetId");
        User owner = null;
        switch (type) {
            case "POST" -> postRepository.findById(id).ifPresentOrElse(p -> {
                m.put("content", preview(p.getContent()));
                m.put("imageUrl", p.getImageUrl());
                m.put("hidden", Boolean.TRUE.equals(p.getIsHidden()));
                m.put("postId", p.getId());
                m.put("contentCreatedAt", p.getCreatedAt());
            }, () -> m.put("deleted", true));
            case "COMMENT" -> commentRepository.findById(id).ifPresentOrElse(c -> {
                m.put("content", preview(c.getContent()));
                m.put("hidden", Boolean.TRUE.equals(c.getIsHidden()));
                m.put("postId", c.getPost() != null ? c.getPost().getId() : null);
                m.put("contentCreatedAt", c.getCreatedAt());
            }, () -> m.put("deleted", true));
            case "COMMUNITY_POST" -> communityPostRepository.findById(id).ifPresentOrElse(p -> {
                m.put("content", preview(p.getContent()));
                m.put("imageUrl", p.getImageUrl());
                m.put("hidden", Boolean.TRUE.equals(p.getIsHidden()));
                m.put("communityId", p.getCommunity() != null ? p.getCommunity().getId() : null);
                m.put("communityName", p.getCommunity() != null ? p.getCommunity().getName() : null);
                m.put("contentCreatedAt", p.getCreatedAt());
            }, () -> m.put("deleted", true));
            case "COMMUNITY_COMMENT" -> communityPostCommentRepository.findById(id).ifPresentOrElse(c -> {
                m.put("content", preview(c.getContent()));
                m.put("hidden", Boolean.TRUE.equals(c.getIsHidden()));
                CommunityPost p = c.getCommunityPost();
                Community community = p != null ? p.getCommunity() : null;
                m.put("communityId", community != null ? community.getId() : null);
                m.put("communityName", community != null ? community.getName() : null);
                m.put("contentCreatedAt", c.getCreatedAt());
            }, () -> m.put("deleted", true));
            case "MESSAGE" -> messageRepository.findById(id).ifPresentOrElse(msg -> {
                // Yalnız şikâyet edilen tek mesaj görünür; sohbetin geri kalanı değil
                m.put("content", preview(msg.getContent()));
                m.put("contentCreatedAt", msg.getCreatedAt());
            }, () -> m.put("deleted", true));
            case "USER" -> userRepository.findById(id).ifPresentOrElse(u -> {
                m.put("content", u.getBio());
                m.put("imageUrl", u.getProfileImageUrl());
            }, () -> m.put("deleted", true));
            default -> m.put("deleted", true);
        }
        owner = ownerOf(type, id);
        m.put("hideable", HIDEABLE.contains(type) && !Boolean.TRUE.equals(m.get("deleted")));
        if (owner != null) {
            Map<String, Object> o = new LinkedHashMap<>(jdbc.queryForMap("""
                    SELECT u.id, u.username, u.full_name AS "fullName", u.profile_image_url AS "profileImageUrl",
                           to_char(u.created_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS "createdAt",
                           coalesce(u.is_active, true) AS "isActive",
                           EXISTS (SELECT 1 FROM user_roles ur JOIN roles ro ON ro.id = ur.role_id
                                   WHERE ur.user_id = u.id AND ro.name = 'ROLE_ADMIN') AS "isAdmin",
                           (SELECT count(*) FROM user_sanctions s WHERE s.user_id = u.id AND s.type = 'WARN') AS warnings,
                           (SELECT count(*) FROM user_sanctions s WHERE s.user_id = u.id AND s.type = 'BAN') AS bans,
                           (SELECT count(*) FROM posts p WHERE p.user_id = u.id AND p.is_hidden) +
                           (SELECT count(*) FROM comments c WHERE c.user_id = u.id AND c.is_hidden) AS "hiddenContent",
                           (SELECT count(*) FROM reports r WHERE r.resolved IS NOT TRUE AND (
                               (r.target_type = 'USER' AND r.target_id = u.id)
                               OR (r.target_type = 'POST' AND r.target_id IN (SELECT id FROM posts WHERE user_id = u.id))
                               OR (r.target_type = 'COMMENT' AND r.target_id IN (SELECT id FROM comments WHERE user_id = u.id)))) AS "openReports"
                    FROM users u WHERE u.id = ?
                    """, owner.getId()));
            m.put("owner", o);
        }
    }

    // ── Karar ─────────────────────────────────────────────────────────────────

    /**
     * Tek içerik için karar. HIDE* içeriği gizler, *WARN sahibini uyarır, *BAN sahibini yasaklar;
     * UNHIDE dışındaki her karar o içeriğin bütün açık şikâyetlerini bu kararla kapatır.
     * Dönen metin işlem kaydı içindir.
     */
    @Transactional
    public String act(String targetType, Long targetId, String action, String reason, Integer days,
                      Long adminId, String adminName) {
        String type = norm(targetType);
        String a = action == null ? "" : action.toUpperCase(Locale.ROOT);
        if (!ACTIONS.contains(a)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_ACTION");
        boolean hide = a.startsWith("HIDE");
        if ((hide || "UNHIDE".equals(a)) && !HIDEABLE.contains(type)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "NOT_HIDEABLE");
        }
        boolean warn = a.endsWith("WARN");
        boolean ban = a.endsWith("BAN") && !"UNBAN".equals(a);
        List<String> done = new ArrayList<>();

        if (warn || ban) {
            User owner = ownerOf(type, targetId);
            if (owner == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "OWNER_NOT_FOUND");
            String why = reason == null || reason.isBlank() ? "Topluluk kurallarına aykırı içerik" : reason.trim();
            // Önce yasak/uyarı: admin yasaklanamaz hatası içerik gizlenmeden döner
            if (ban) done.add(adminUserService.ban(owner.getId(), why, days, adminId, adminName));
            if (warn) done.add(adminUserService.warn(owner.getId(), why, adminName));
        }
        if (hide) {
            moderationService.setContentHidden(type, targetId, true);
            done.add("hide " + type + "#" + targetId);
        }
        if ("UNHIDE".equals(a)) {
            moderationService.setContentHidden(type, targetId, false);
            return "unhide " + type + "#" + targetId;
        }
        int closed = resolveAll(type, targetId, a, adminName);
        done.add(closed + " şikâyet kapandı (" + a + ")");
        return String.join("\n", done);
    }

    /** Toplu karar: yalnız DISMISS ve HIDE (uyarı/yasak tek tek verilir). */
    @Transactional
    public String bulk(List<Map<String, Object>> targets, String action, String adminName) {
        String a = action == null ? "" : action.toUpperCase(Locale.ROOT);
        if (!"DISMISS".equals(a) && !"HIDE".equals(a)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_ACTION");
        if (targets == null || targets.isEmpty() || targets.size() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_TARGETS");
        }
        int items = 0, closed = 0;
        for (Map<String, Object> t : targets) {
            String type = norm(String.valueOf(t.get("targetType")));
            Long id = Long.valueOf(String.valueOf(t.get("targetId")));
            if ("HIDE".equals(a)) {
                if (!HIDEABLE.contains(type)) continue; // kullanıcı/mesaj toplu gizlenemez
                moderationService.setContentHidden(type, id, true);
            }
            closed += resolveAll(type, id, a, adminName);
            items++;
        }
        return "bulk " + a + ": " + items + " içerik, " + closed + " şikâyet";
    }

    private int resolveAll(String type, Long targetId, String resolution, String adminName) {
        List<Report> open = new ArrayList<>(reportRepository.findByTargetTypeAndTargetIdAndResolvedFalse(type, targetId));
        // Eski kayıtlarda tür küçük harfle yazılmış olabilir
        if (!type.equals(type.toLowerCase(Locale.ROOT))) {
            open.addAll(reportRepository.findByTargetTypeAndTargetIdAndResolvedFalse(type.toLowerCase(Locale.ROOT), targetId));
        }
        LocalDateTime now = LocalDateTime.now();
        for (Report r : open) {
            r.setResolved(true);
            r.setResolution(resolution);
            r.setResolvedBy(adminName);
            r.setResolvedAt(now);
        }
        reportRepository.saveAll(open);
        return open.size();
    }

    // ── Yardımcılar ──────────────────────────────────────────────────────────

    private User ownerOf(String type, Long id) {
        return switch (type) {
            case "POST" -> postRepository.findById(id).map(Post::getUser).orElse(null);
            case "COMMENT" -> commentRepository.findById(id).map(Comment::getUser).orElse(null);
            case "COMMUNITY_POST" -> communityPostRepository.findById(id).map(CommunityPost::getUser).orElse(null);
            case "COMMUNITY_COMMENT" -> communityPostCommentRepository.findById(id).map(CommunityPostComment::getUser).orElse(null);
            case "MESSAGE" -> messageRepository.findById(id).map(Message::getSender).orElse(null);
            case "USER" -> userRepository.findById(id).orElse(null);
            default -> null;
        };
    }

    static Set<String> typesOf(String type) {
        if (type == null) return null;
        return switch (type) {
            case "posts" -> Set.of("POST");
            case "comments" -> Set.of("COMMENT");
            case "community" -> Set.of("COMMUNITY_POST", "COMMUNITY_COMMENT");
            case "messages" -> Set.of("MESSAGE");
            case "users" -> Set.of("USER");
            default -> null;
        };
    }

    private static String norm(String type) {
        return type == null ? "" : type.toUpperCase(Locale.ROOT);
    }

    private static String preview(String content) {
        if (content == null) return null;
        return content.length() > PREVIEW ? content.substring(0, PREVIEW - 1) + "…" : content;
    }
}
