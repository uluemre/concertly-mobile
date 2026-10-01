package com.concertly.backend.service.ingest;

import com.concertly.backend.service.ingest.DuplicateMergeReport.ApplyRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.io.File;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * GERCEK Postgres uzerinde mukerrer birlestirme (N-08/N-09) dogrulamasi.
 * YALNIZCA bir kopya veritabanina karsi calistirilir; asla concertly_mobile / production'a degil.
 *
 * ./mvnw -o test -Dtest=DuplicateMergeRealDbIT -Dmerge.it=true -Dmerge.out=<dizin>
 *   (ortam: DB_URL=jdbc:postgresql://localhost:5432/concertly_merge_test DDL_AUTO=none)
 */
@SpringBootTest
@EnabledIfSystemProperty(named = "merge.it", matches = "true")
class DuplicateMergeRealDbIT {

    @Autowired private DuplicateMergeService service;
    @Autowired private JdbcTemplate jdbc;

    private static final List<String> TABLES = List.of("artists", "venues", "events", "artist_follows", "artist_reviews",
            "venue_reviews", "event_attendances", "event_bookmarks", "event_verifications", "event_reviews",
            "concert_buddies", "setlist_submissions", "posts", "bingo_cards", "event_sources", "notifications");

    private Map<String, Long> snapshot() {
        Map<String, Long> m = new LinkedHashMap<>();
        for (String t : TABLES) m.put(t, jdbc.queryForObject("SELECT count(*) FROM " + t, Long.class));
        return m;
    }

    @Test
    void dryRunApplyAndIdempotency() throws Exception {
        String url = jdbc.queryForObject("SELECT current_database()", String.class);
        assertEquals("concertly_merge_test", url, "Yalnizca kopya veritabani!");
        ObjectMapper om = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);
        File dir = new File(System.getProperty("merge.out", "."));

        Map<String, Long> before = snapshot();
        DuplicateMergeReport dry = service.dryRun("LOW");
        assertTrue(dry.dryRun());
        assertEquals(before, snapshot(), "dry-run veri yazmamali");
        DuplicateMergeReport dry2 = service.dryRun("LOW");
        assertEquals(om.writeValueAsString(dry), om.writeValueAsString(dry2), "dry-run deterministik olmali");

        DuplicateMergeReport applied = service.apply(new ApplyRequest(null, null, null, "LOW"));
        Map<String, Long> after = snapshot();

        DuplicateMergeReport dryAfter = service.dryRun("LOW");
        DuplicateMergeReport applyAgain = service.apply(new ApplyRequest(null, null, null, "LOW"));
        Map<String, Long> after2 = snapshot();

        om.writeValue(new File(dir, "dry.json"), dry);
        om.writeValue(new File(dir, "apply.json"), applied);
        om.writeValue(new File(dir, "dryAfter.json"), dryAfter);
        om.writeValue(new File(dir, "applyAgain.json"), applyAgain);
        om.writeValue(new File(dir, "counts.json"), Map.of("before", before, "after", after, "after2", after2));

        // dry-run'in HIGH (autoApply) bolumu == apply; oneriler (MEDIUM/LOW) hicbir zaman uygulanmaz
        for (String k : List.of("artistsMerged", "venuesMerged", "eventsMerged")) {
            assertEquals(dry.totals().get(k), applied.totals().get(k), k + ": dry-run == apply");
        }
        assertEquals("HIGH", applied.minConfidence());
        assertTrue(dryAfter.artistGroups().isEmpty() && dryAfter.venueGroups().isEmpty() && dryAfter.eventGroups().isEmpty(),
                "ikinci dry-run'da otomatik (HIGH) grup kalmamali");
        assertTrue(applyAgain.artistGroups().isEmpty() && applyAgain.venueGroups().isEmpty() && applyAgain.eventGroups().isEmpty(),
                "ikinci apply bir sey degistirmemeli");
        assertEquals(after, after2, "ikinci apply satir sayilarini degistirmemeli");
        assertEquals(before.get("artists"), after.get("artists"));
        assertEquals(before.get("venues"), after.get("venues"));
        assertEquals(before.get("events"), after.get("events"));
    }
}
