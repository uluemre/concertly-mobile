package com.concertly.backend.service.ingest;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Mukerrer birlestirmenin toplu satir tasima islemleri (N-08 / N-09).
 *
 * Neden ayri sinif: tasima, tekillik kisitlarini (user_id + hedef) cozmek icin dogrudan SQL
 * kullanir; sinif mock'lanarak DuplicateMergeService mantigi veritabanisiz test edilir.
 * Tablo/kolon adlari bu dosyadaki SABITLERDEN gelir, istemci girdisi SQL'e hic girmez.
 *
 * Her islemin onizleme (yazmaz, yalnizca sayar) ve uygulama surumu vardir; ikisi AYNI
 * sayi anahtarlarini dondurur, boylece dry-run raporu ile uygulama raporu karsilastirilabilir.
 * Uygulama surumleri cagiran @Transactional icinde calisir: hata olursa tamami geri alinir.
 *
 * Tekillik cakismasi kurali: hedefte (asil kayitta) ayni kullanicinin satiri varsa asilin satiri
 * KALIR, mukerrerin satiri silinir ve "conflictsDropped" sayilir. Istisna: etkinlik katilimi
 * (event_attendances) - asil satir kalir ama mukerrerdeki durum daha guclu ise (WENT > GOING >
 * INTERESTED) asilin durumu yukseltilir ("attendanceStatusUpgrades").
 */
@Component
public class MergeStore {

    public static final String CONFLICTS = "conflictsDropped";

    private final EntityManager em;

    public MergeStore(EntityManager em) {
        this.em = em;
    }

    // ───────────────────────── sanatci ─────────────────────────

    public Map<String, Integer> previewArtist(long from, long to) { return artistMove(from, to, false); }
    public Map<String, Integer> applyArtist(long from, long to)   { return artistMove(from, to, true); }

    private Map<String, Integer> artistMove(long from, long to, boolean apply) {
        if (apply) em.flush(); // bekleyen varlik degisiklikleri (isaretci, doldurulan alanlar) SQL'den once yazilsin
        Map<String, Integer> out = new LinkedHashMap<>();
        out.put(CONFLICTS, 0);
        moveAll(out, "events", "events", "artist_id", from, to, apply);
        moveUnique(out, "follows", "artist_follows", "artist_id", List.of("user_id"), from, to, apply);
        moveUnique(out, "reviews", "artist_reviews", "artist_id", List.of("user_id"), from, to, apply);
        movePointers(out, "artists", "merged_into_artist_id", from, to, apply);
        if (apply) em.clear(); // toplu SQL sonrasi bayat varlik kalmasin
        return out;
    }

    // ───────────────────────── mekan ─────────────────────────

    public Map<String, Integer> previewVenue(long from, long to) { return venueMove(from, to, false); }
    public Map<String, Integer> applyVenue(long from, long to)   { return venueMove(from, to, true); }

    private Map<String, Integer> venueMove(long from, long to, boolean apply) {
        if (apply) em.flush(); // bekleyen varlik degisiklikleri (isaretci, doldurulan alanlar) SQL'den once yazilsin
        Map<String, Integer> out = new LinkedHashMap<>();
        out.put(CONFLICTS, 0);
        moveAll(out, "events", "events", "venue_id", from, to, apply);
        moveUnique(out, "reviews", "venue_reviews", "venue_id", List.of("user_id"), from, to, apply);
        movePointers(out, "venues", "merged_into_venue_id", from, to, apply);
        if (apply) em.clear(); // toplu SQL sonrasi bayat varlik kalmasin
        return out;
    }

    // ───────────────────────── etkinlik ─────────────────────────

    public Map<String, Integer> previewEventChildren(long from, long to) { return eventMove(from, to, false); }
    public Map<String, Integer> applyEventChildren(long from, long to)   { return eventMove(from, to, true); }

    private Map<String, Integer> eventMove(long from, long to, boolean apply) {
        if (apply) em.flush(); // bekleyen varlik degisiklikleri (isaretci, doldurulan alanlar) SQL'den once yazilsin
        Map<String, Integer> out = new LinkedHashMap<>();
        out.put(CONFLICTS, 0);
        upgradeAttendanceStatus(out, from, to, apply);
        moveUnique(out, "attendances", "event_attendances", "event_id", List.of("user_id"), from, to, apply);
        moveUnique(out, "bookmarks", "event_bookmarks", "event_id", List.of("user_id"), from, to, apply);
        moveUnique(out, "verifications", "event_verifications", "event_id", List.of("user_id"), from, to, apply);
        moveUnique(out, "eventReviews", "event_reviews", "event_id", List.of("user_id"), from, to, apply);
        moveUnique(out, "concertBuddies", "concert_buddies", "event_id", List.of("user_id"), from, to, apply);
        moveUnique(out, "setlistSubmissions", "setlist_submissions", "event_id", List.of("user_id", "kind"), from, to, apply);
        moveAll(out, "posts", "posts", "event_id", from, to, apply);
        moveAll(out, "bingoCards", "bingo_cards", "event_id", from, to, apply); // FK yok, tekillik yok
        // Bildirimler: yalnizca varlik turu 'event' olanlar
        out.put("notifications", apply
                ? update("UPDATE notifications SET entity_id = :to WHERE entity_type = 'event' AND entity_id = :from", from, to)
                : count("SELECT count(*) FROM notifications WHERE entity_type = 'event' AND entity_id = :from", from, to));
        if (!apply) {
            // Uygulamada kaynak satirlarini EventMergeService tasir; onizlemede yalnizca sayilir.
            out.put("sourceLinks", count("SELECT count(*) FROM event_sources WHERE event_id = :from", from, to));
        }
        movePointers(out, "events", "merged_into_event_id", from, to, apply);
        if (apply) em.clear(); // toplu SQL sonrasi bayat varlik kalmasin
        return out;
    }

    // ───────────────────────── ortak ─────────────────────────

    public void flush() { em.flush(); }

    /** Toplu SQL'den sonra bayat varlik kalmasin: sonraki okumalar guncel satirlari gorur. */
    public void clear() { em.clear(); }

    /** Tekillik kisiti olmayan tablo: hepsi tasinir. */
    private void moveAll(Map<String, Integer> out, String key, String table, String fk,
                         long from, long to, boolean apply) {
        out.put(key, apply
                ? update("UPDATE " + table + " SET " + fk + " = :to WHERE " + fk + " = :from", from, to)
                : count("SELECT count(*) FROM " + table + " WHERE " + fk + " = :from", from, to));
    }

    /**
     * Tekillik kisitli tablo: hedefte ayni (user_id[, kind]) satiri olan mukerrer satirlar silinir
     * (conflictsDropped), kalanlar tasinir. "key" = tasinan (cakismayan) satir sayisi.
     */
    private void moveUnique(Map<String, Integer> out, String key, String table, String fk,
                            List<String> sameCols, long from, long to, boolean apply) {
        StringBuilder same = new StringBuilder();
        for (String c : sameCols) same.append(" AND c.").append(c).append(" = d.").append(c);
        String conflictWhere = "d." + fk + " = :from AND EXISTS (SELECT 1 FROM " + table + " c WHERE c." + fk
                + " = :to" + same + ")";
        int total = count("SELECT count(*) FROM " + table + " WHERE " + fk + " = :from", from, to);
        int conflicts = count("SELECT count(*) FROM " + table + " d WHERE " + conflictWhere, from, to);
        if (apply) {
            int deleted = update("DELETE FROM " + table + " d WHERE " + conflictWhere, from, to);
            int moved = update("UPDATE " + table + " SET " + fk + " = :to WHERE " + fk + " = :from", from, to);
            out.put(key, moved);
            out.merge(CONFLICTS, deleted, Integer::sum);
        } else {
            out.put(key, total - conflicts);
            out.merge(CONFLICTS, conflicts, Integer::sum);
        }
    }

    /**
     * Daha once bu kayda birlestirilmis kayitlar varsa (zincir) onlari yeni asil kayda yonlendirir:
     * isaretci her zaman kok'u gosterir, asla birlestirilmis bir satiri degil.
     */
    private void movePointers(Map<String, Integer> out, String table, String pointerCol,
                              long from, long to, boolean apply) {
        out.put("repointedMergePointers", apply
                ? update("UPDATE " + table + " SET " + pointerCol + " = :to WHERE " + pointerCol + " = :from", from, to)
                : count("SELECT count(*) FROM " + table + " WHERE " + pointerCol + " = :from", from, to));
    }

    private static final String RANK_D = "(CASE d.status WHEN 'WENT' THEN 3 WHEN 'GOING' THEN 2 WHEN 'INTERESTED' THEN 1 ELSE 0 END)";
    private static final String RANK_C = "(CASE c.status WHEN 'WENT' THEN 3 WHEN 'GOING' THEN 2 WHEN 'INTERESTED' THEN 1 ELSE 0 END)";

    /** Ayni kullanici iki kayitta da varsa: asil satirin durumu, mukerrerdeki daha gucluyse yukseltilir. */
    private void upgradeAttendanceStatus(Map<String, Integer> out, long from, long to, boolean apply) {
        String join = "event_attendances d WHERE d.event_id = :from AND c.event_id = :to AND c.user_id = d.user_id AND "
                + RANK_D + " > " + RANK_C;
        out.put("attendanceStatusUpgrades", apply
                ? update("UPDATE event_attendances c SET status = d.status FROM " + join, from, to)
                : count("SELECT count(*) FROM event_attendances c, " + join, from, to));
    }

    private int count(String sql, long from, long to) {
        Query q = em.createNativeQuery(sql);
        bind(q, sql, from, to);
        return ((Number) q.getSingleResult()).intValue();
    }

    private int update(String sql, long from, long to) {
        Query q = em.createNativeQuery(sql);
        bind(q, sql, from, to);
        return q.executeUpdate();
    }

    private static void bind(Query q, String sql, long from, long to) {
        if (sql.contains(":from")) q.setParameter("from", from);
        if (sql.contains(":to")) q.setParameter("to", to);
    }
}
