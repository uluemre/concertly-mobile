package com.concertly.backend.service;

import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Organizer;
import com.concertly.backend.model.OrganizerRequest;
import com.concertly.backend.repository.OrganizerRepository;
import com.concertly.backend.repository.OrganizerRequestRepository;
import com.concertly.backend.repository.SearchText;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Admin organizatör yönetimi (Meta / Spotify for Artists doğrulama incelemesi gibi):
 * başvuranın güven sinyalleri, iç not, onaylı organizatörleri askıya alma ve yetkileri.
 */
@Service
public class AdminOrganizerService {

    private static final String DATE = "to_char(%s, 'YYYY-MM-DD\"T\"HH24:MI:SS')";

    /** Başvuranın hesabı hakkında güven sinyalleri (u = users satırı). */
    private static final String SIGNALS = """
            u.id AS "userId", u.username, u.full_name AS "fullName", u.profile_image_url AS "profileImageUrl",
            %s AS "accountCreatedAt", coalesce(u.email_verified, false) AS "emailVerified",
            coalesce(u.is_active, true) AS "userActive",
            (SELECT count(*) FROM follows f WHERE f.following_id = u.id AND (f.status IS NULL OR f.status = 'ACCEPTED')) AS followers,
            (SELECT count(*) FROM posts p WHERE p.user_id = u.id) AS posts,
            (SELECT count(*) FROM event_attendances a WHERE a.user_id = u.id AND a.status IN ('GOING', 'WENT')) AS concerts,
            (SELECT count(*) FROM reports r WHERE (r.target_type = 'USER' AND r.target_id = u.id)
                OR (r.target_type = 'POST' AND r.target_id IN (SELECT id FROM posts WHERE user_id = u.id))
                OR (r.target_type = 'COMMENT' AND r.target_id IN (SELECT id FROM comments WHERE user_id = u.id))) AS reports,
            (SELECT count(*) FROM organizer_requests o2 WHERE o2.user_id = u.id) AS "requestCount"
            """.formatted(DATE.formatted("u.created_at"));

    private final JdbcTemplate jdbc;
    private final OrganizerRequestRepository requestRepository;
    private final OrganizerRepository organizerRepository;
    private final OrganizerEventService organizerEventService;
    private final NotificationService notificationService;

    public AdminOrganizerService(JdbcTemplate jdbc,
                                 OrganizerRequestRepository requestRepository,
                                 OrganizerRepository organizerRepository,
                                 OrganizerEventService organizerEventService,
                                 NotificationService notificationService) {
        this.jdbc = jdbc;
        this.requestRepository = requestRepository;
        this.organizerRepository = organizerRepository;
        this.organizerEventService = organizerEventService;
        this.notificationService = notificationService;
    }

    // ── Başvurular ────────────────────────────────────────────────────────────

    /** status: PENDING (varsayılan, eskiden yeniye) | APPROVED | REJECTED | ALL (yeniden eskiye). */
    public List<Map<String, Object>> requests(String status) {
        String s = status == null ? "PENDING" : status.toUpperCase(Locale.ROOT);
        boolean all = "ALL".equals(s);
        if (!all && !Set.of("PENDING", "APPROVED", "REJECTED").contains(s)) throw new IllegalArgumentException("INVALID_STATUS");
        String sql = """
                SELECT r.id, r.organization_name AS "organizationName", r.type, r.website, r.instagram, r.message,
                       r.status, r.review_note AS "reviewNote", r.internal_note AS "internalNote", r.reviewed_by AS "reviewedBy",
                       %s AS "createdAt", %s AS "reviewedAt",
                       %s
                FROM organizer_requests r JOIN users u ON u.id = r.user_id
                %s
                ORDER BY r.created_at %s
                LIMIT 200
                """.formatted(DATE.formatted("r.created_at"), DATE.formatted("r.reviewed_at"), SIGNALS,
                all ? "" : "WHERE r.status = ?", "PENDING".equals(s) ? "ASC" : "DESC");
        return all ? jdbc.queryForList(sql) : jdbc.queryForList(sql, s);
    }

    public Map<String, Object> request(Long id) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT r.id, r.organization_name AS "organizationName", r.type, r.website, r.instagram, r.message,
                       r.status, r.review_note AS "reviewNote", r.internal_note AS "internalNote", r.reviewed_by AS "reviewedBy",
                       %s AS "createdAt", %s AS "reviewedAt",
                       %s
                FROM organizer_requests r JOIN users u ON u.id = r.user_id
                WHERE r.id = ?
                """.formatted(DATE.formatted("r.created_at"), DATE.formatted("r.reviewed_at"), SIGNALS), id);
        if (rows.isEmpty()) throw new ResourceNotFoundException("REQUEST_NOT_FOUND");
        Map<String, Object> out = new LinkedHashMap<>(rows.get(0));
        // Aynı kişinin önceki başvuruları (ret gerekçeleriyle)
        out.put("history", jdbc.queryForList("""
                SELECT r.id, r.organization_name AS "organizationName", r.status, r.review_note AS "reviewNote",
                       %s AS "createdAt"
                FROM organizer_requests r
                WHERE r.user_id = (SELECT user_id FROM organizer_requests WHERE id = ?) AND r.id <> ?
                ORDER BY r.created_at DESC
                """.formatted(DATE.formatted("r.created_at")), id, id));
        return out;
    }

    @Transactional
    public void setInternalNote(Long id, String note) {
        OrganizerRequest r = requestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("REQUEST_NOT_FOUND"));
        String n = note == null ? "" : note.trim();
        if (n.length() > 1000) throw new IllegalArgumentException("NOTE_TOO_LONG");
        r.setInternalNote(n.isEmpty() ? null : n);
        requestRepository.save(r);
    }

    // ── Onaylı organizatörler ────────────────────────────────────────────────

    public List<Map<String, Object>> organizers(String q) {
        List<Object> args = new ArrayList<>();
        String where = "TRUE";
        if (q != null && !q.isBlank()) {
            String fold = "lower(translate(%s, '" + SearchText.FOLD_FROM + "', '" + SearchText.FOLD_TO + "'))";
            where = "(" + fold.formatted("o.name") + " LIKE ? ESCAPE '!' OR " + fold.formatted("u.username") + " LIKE ? ESCAPE '!')";
            String p = SearchText.containsPattern(q.trim());
            args.add(p);
            args.add(p);
        }
        return jdbc.queryForList("""
                SELECT o.id, o.name, o.type, o.logo_url AS "logoUrl", o.verified, o.can_announce AS "canAnnounce", o.active,
                       %s AS "createdAt", u.id AS "userId", u.username,
                       (SELECT count(*) FROM events e WHERE e.organizer_id = o.id AND e.event_date >= now()
                          AND e.delisted_reason IS NULL AND e.merged_into_event_id IS NULL) AS upcoming,
                       (SELECT count(*) FROM events e WHERE e.organizer_id = o.id AND e.merged_into_event_id IS NULL) AS "totalEvents",
                       (SELECT coalesce(sum(coalesce(e.view_count, 0)), 0) FROM events e WHERE e.organizer_id = o.id) AS views
                FROM organizers o JOIN users u ON u.id = o.owner_user_id
                WHERE %s
                ORDER BY o.active DESC, upcoming DESC, o.created_at DESC
                LIMIT 200
                """.formatted(DATE.formatted("o.created_at"), where), args.toArray());
    }

    public Map<String, Object> organizer(Long id) {
        Organizer o = organizerRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("ORGANIZER_NOT_FOUND"));
        Map<String, Object> out = new LinkedHashMap<>(OrganizerService.summary(o));
        out.put("owner", jdbc.queryForMap("SELECT " + SIGNALS + " FROM users u WHERE u.id = (SELECT owner_user_id FROM organizers WHERE id = ?)", id));
        out.put("totals", organizerEventService.totalsOf(id));
        out.put("upcoming", organizerEventService.eventsOf(id, false));
        out.put("past", organizerEventService.eventsOf(id, true));
        return out;
    }

    /**
     * Gövde: { active?, canAnnounce?, verified?, name? }. Askıya alınan organizatör paneli
     * kullanamaz ve etkinlikleri artık onaysız yayına giremez (yayındakiler kalır). Dönen
     * liste işlem kaydı içindir.
     */
    @Transactional
    public List<String> update(Long id, Map<String, Object> body) {
        Organizer o = organizerRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("ORGANIZER_NOT_FOUND"));
        List<String> diff = new ArrayList<>();
        if (body.containsKey("name")) {
            String name = AdminContentService.text(body.get("name"), 1, 120, "INVALID_NAME");
            if (!name.equals(o.getName())) {
                diff.add("name: " + o.getName() + " → " + name);
                o.setName(name);
            }
        }
        Boolean active = bool(body, "active");
        if (active != null && active != o.isActive()) {
            o.setActive(active);
            diff.add("active: " + !active + " → " + active);
            notificationService.sendSystem(o.getOwner().getId(), active ? "organizer_reactivated" : "organizer_suspended",
                    "user", o.getId(), active ? o.getName() + " organizatör hesabı yeniden açıldı"
                            : o.getName() + " organizatör hesabı askıya alındı");
        }
        Boolean announce = bool(body, "canAnnounce");
        if (announce != null && announce != o.isCanAnnounce()) {
            o.setCanAnnounce(announce);
            diff.add("canAnnounce: " + !announce + " → " + announce);
        }
        Boolean verified = bool(body, "verified");
        if (verified != null && verified != o.isVerified()) {
            o.setVerified(verified);
            diff.add("verified: " + !verified + " → " + verified);
        }
        organizerRepository.save(o);
        return diff;
    }

    private static Boolean bool(Map<String, Object> body, String key) {
        if (!body.containsKey(key)) return null;
        Object v = body.get(key);
        if (v instanceof Boolean b) return b;
        if ("true".equals(String.valueOf(v))) return true;
        if ("false".equals(String.valueOf(v))) return false;
        throw new IllegalArgumentException("INVALID_VALUE");
    }
}
