package com.concertly.backend.service.ingest;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.ToIntFunction;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * N-08 / N-09: toplu tasima SQL'i. Veritabani yok; EntityManager sahte ve gonderilen SQL'ler
 * incelenir: tekillik cakismalari, durum yukseltme, sira ve onizlemenin yazmamasi.
 */
class MergeStoreTest {

    private EntityManager em;
    private MergeStore store;
    private final List<String> sqls = new ArrayList<>();
    /** SQL'e gore sayim / etkilenen satir cevabi. */
    private ToIntFunction<String> answer;

    @BeforeEach
    void setUp() {
        em = mock(EntityManager.class);
        store = new MergeStore(em);
        sqls.clear();
        answer = sql -> 0;
        when(em.createNativeQuery(anyString())).thenAnswer(inv -> {
            String sql = inv.getArgument(0);
            sqls.add(sql);
            Query q = mock(Query.class);
            when(q.setParameter(anyString(), any())).thenReturn(q);
            when(q.getSingleResult()).thenAnswer(i -> (long) answer.applyAsInt(sql));
            when(q.executeUpdate()).thenAnswer(i -> answer.applyAsInt(sql));
            return q;
        });
    }

    private boolean wrote() {
        return sqls.stream().anyMatch(s -> s.startsWith("UPDATE") || s.startsWith("DELETE") || s.startsWith("INSERT"));
    }

    @Test
    void previewCountsConflictsAndWritesNothing() {
        answer = sql -> {
            if (sql.startsWith("SELECT count(*) FROM artist_follows d WHERE")) return 1;   // cakisan
            if (sql.startsWith("SELECT count(*) FROM artist_follows WHERE")) return 3;     // toplam
            if (sql.startsWith("SELECT count(*) FROM events WHERE artist_id")) return 5;
            return 0;
        };

        Map<String, Integer> out = store.previewArtist(2, 1);

        assertEquals(5, out.get("events"));
        assertEquals(2, out.get("follows"));                // 3 - 1 cakisma
        assertEquals(1, out.get("conflictsDropped"));       // kullanici iki kayda da takipci: mukerrerinki dusurulur
        assertFalse(wrote(), sqls.toString());
        verify(em, never()).flush();
        verify(em, never()).clear();
    }

    @Test
    void applyDeletesConflictingRowsThenMovesTheRestInsideTheSameCall() {
        answer = sql -> {
            if (sql.startsWith("DELETE FROM artist_follows")) return 1;
            if (sql.startsWith("UPDATE artist_follows")) return 2;
            if (sql.startsWith("UPDATE events SET artist_id")) return 5;
            return 0;
        };

        Map<String, Integer> out = store.applyArtist(2, 1);

        assertEquals(2, out.get("follows"));
        assertEquals(1, out.get("conflictsDropped"));
        assertEquals(5, out.get("events"));
        int del = indexOf("DELETE FROM artist_follows");
        int upd = indexOf("UPDATE artist_follows");
        assertTrue(del >= 0 && upd > del, "cakisan satir tasimadan ONCE silinmeli: " + sqls);
        assertTrue(sqls.get(del).contains("EXISTS") && sqls.get(del).contains("c.user_id = d.user_id"));
        // Zincir: bu kayda daha once birlestirilmis olanlar yeni asil kayda yonlendirilir
        assertTrue(sqls.stream().anyMatch(s -> s.startsWith("UPDATE artists SET merged_into_artist_id = :to WHERE merged_into_artist_id = :from")));
        InOrder order = inOrder(em);
        order.verify(em).flush();     // bekleyen isaretci degisiklikleri once yazilir
        order.verify(em, atLeastOnce()).createNativeQuery(anyString());
        order.verify(em).clear();     // sonra bayat varlik kalmaz
    }

    @Test
    void venueMoveHandlesEventsReviewsAndPointers() {
        answer = sql -> sql.startsWith("DELETE FROM venue_reviews") ? 1 : 2;

        Map<String, Integer> out = store.applyVenue(5, 4);

        assertEquals(2, out.get("events"));
        assertEquals(2, out.get("reviews"));
        assertEquals(1, out.get("conflictsDropped"));
        assertTrue(sqls.stream().anyMatch(s -> s.startsWith("UPDATE events SET venue_id = :to WHERE venue_id = :from")));
        assertTrue(sqls.stream().anyMatch(s -> s.contains("merged_into_venue_id")));
    }

    @Test
    void eventChildrenCoverEveryTableAndUpgradeAttendanceBeforeDroppingConflicts() {
        store.applyEventChildren(9, 8);

        for (String table : List.of("event_attendances", "event_bookmarks", "event_verifications", "event_reviews",
                "concert_buddies", "setlist_submissions", "posts", "bingo_cards")) {
            assertTrue(sqls.stream().anyMatch(s -> s.startsWith("UPDATE " + table + " SET event_id = :to WHERE event_id = :from")),
                    table + " tasinmali");
        }
        // Tekillik kisitli olanlarda once cakisanlar silinir
        for (String table : List.of("event_attendances", "event_bookmarks", "event_verifications", "event_reviews",
                "concert_buddies", "setlist_submissions")) {
            int del = indexOf("DELETE FROM " + table);
            int upd = indexOf("UPDATE " + table + " SET event_id");
            assertTrue(del >= 0 && upd > del, table);
        }
        // Setlist tekilligi (user_id, event_id, kind)
        assertTrue(sqls.get(indexOf("DELETE FROM setlist_submissions")).contains("c.kind = d.kind"));
        // Katilim: durum yukseltme, cakisan satir silinmeden ONCE; WENT > GOING > INTERESTED
        int upgrade = indexOf("UPDATE event_attendances c SET status = d.status");
        assertTrue(upgrade >= 0 && upgrade < indexOf("DELETE FROM event_attendances"), sqls.toString());
        String up = sqls.get(upgrade);
        assertTrue(up.contains("'WENT' THEN 3") && up.contains("'GOING' THEN 2") && up.contains("'INTERESTED' THEN 1"));
        assertTrue(up.contains(") > ("), "yalnizca daha guclu durum yukseltir");
        // Bildirimler yalnizca 'event' varlik turu
        assertTrue(sqls.stream().anyMatch(s -> s.startsWith("UPDATE notifications SET entity_id = :to")
                && s.contains("entity_type = 'event'")));
        // Zincir: bu etkinlige daha once birlestirilmisler
        assertTrue(sqls.stream().anyMatch(s -> s.startsWith("UPDATE events SET merged_into_event_id = :to")));
        // event_sources'u EventMergeService tasir, burada dokunulmaz
        assertTrue(sqls.stream().noneMatch(s -> s.contains("event_sources")));
    }

    @Test
    void eventPreviewReportsUpgradesAndSourceLinksWithoutWriting() {
        answer = sql -> {
            if (sql.startsWith("SELECT count(*) FROM event_attendances c, event_attendances d")) return 2;
            if (sql.startsWith("SELECT count(*) FROM event_sources")) return 3;
            if (sql.startsWith("SELECT count(*) FROM event_attendances d WHERE")) return 1;
            if (sql.startsWith("SELECT count(*) FROM event_attendances WHERE")) return 4;
            return 0;
        };

        Map<String, Integer> out = store.previewEventChildren(9, 8);

        assertEquals(2, out.get("attendanceStatusUpgrades"));
        assertEquals(3, out.get("sourceLinks"));
        assertEquals(3, out.get("attendances"));      // 4 - 1 cakisma
        assertEquals(1, out.get("conflictsDropped"));
        assertFalse(wrote(), sqls.toString());
    }

    private int indexOf(String prefix) {
        for (int i = 0; i < sqls.size(); i++) if (sqls.get(i).startsWith(prefix)) return i;
        return -1;
    }
}
