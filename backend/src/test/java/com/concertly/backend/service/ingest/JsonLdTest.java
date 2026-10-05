package com.concertly.backend.service.ingest;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Ortak JSON-LD okuyucu: gerçek sayfalardan alınmış örneklerle. */
class JsonLdTest {

    private static String fixture(String name) throws Exception {
        return Files.readString(Path.of("src/test/resources/fixtures/sources/" + name), StandardCharsets.UTF_8);
    }

    private static String page(String json) {
        return "<html><script type=\"application/ld+json\">" + json + "</script></html>";
    }

    @Test
    void zorluEventWithTrailingCommaIsStillRead() throws Exception {
        // Zorlu PSM sayfasındaki blok dizinin sonunda fazladan virgül taşıyor; katı okuyucu atıyordu
        List<JsonNode> events = JsonLd.events(fixture("zorlu-event.html"));
        assertEquals(1, events.size());
        assertEquals(LocalDateTime.of(2026, 11, 21, 21, 0),
                JsonLd.toLocalDateTime(events.get(0).path("startDate").asText()));
    }

    @Test
    void biletinoMusicEventIsRecognised() throws Exception {
        List<JsonNode> events = JsonLd.events(fixture("biletino-event.html"));
        assertEquals(1, events.size());
        assertEquals("Halloween Party", JsonLd.text(events.get(0).path("name")));
        assertEquals(LocalDateTime.of(2026, 10, 26, 19, 0),
                JsonLd.toLocalDateTime(events.get(0).path("startDate").asText()));
    }

    @Test
    void eventsInsideGraphAndArraysAreFound() {
        String html = page("{\"@graph\":[{\"@type\":\"WebSite\"},{\"@type\":[\"Event\",\"MusicEvent\"],\"name\":\"A\"}]}")
                + page("[{\"@type\":\"Festival\",\"name\":\"B\"},{\"@type\":\"Organization\"}]");
        assertEquals(List.of("A", "B"), JsonLd.events(html).stream().map(e -> JsonLd.text(e.path("name"))).toList());
    }

    @Test
    void brokenBlockIsSkippedNotFatal() {
        String html = page("{ bu json degil") + page("{\"@type\":\"Event\",\"name\":\"C\"}");
        assertEquals(1, JsonLd.events(html).size());
    }

    @Test
    void helpers() {
        assertEquals("İstanbul", JsonLd.normalizeCity("İstanbul Avrupa"));
        assertEquals(41.05, JsonLd.toDouble(JsonLd.blocks(page("{\"v\":\"41,05\"}")).get(0).path("v")));
        assertEquals("https://x/a.jpg",
                JsonLd.first(JsonLd.blocks(page("{\"image\":[{\"@type\":\"ImageObject\",\"url\":\"https://x/a.jpg\"}]}")).get(0).path("image")));
        assertEquals(LocalDateTime.of(2026, 10, 26, 19, 0), JsonLd.toLocalDateTime("2026-10-26T16:00:00Z"));
        assertNull(JsonLd.toLocalDateTime("26 Ekim"));
    }
}
