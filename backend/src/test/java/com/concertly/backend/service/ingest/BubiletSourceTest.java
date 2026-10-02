package com.concertly.backend.service.ingest;

import org.junit.jupiter.api.Test;
import org.springframework.boot.web.client.RestTemplateBuilder;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Bubilet JSON-LD ayristirmasi (ag yok; sayfa ornegi gercek Hadise sayfasindan kisaltildi). */
class BubiletSourceTest {

    private static final String PAGE_URL = "https://www.bubilet.com.tr/ankara/etkinlik/hadise";

    private final BubiletSource source = new BubiletSource(new RestTemplateBuilder(), "test", 0, 0);

    private static String page(String subEvents) {
        return "<html><script type=\"application/ld+json\">{\"@type\":\"Organization\",\"name\":\"Bubilet\"}</script>"
                + "<script type=\"application/ld+json\">{\"@context\":\"https://schema.org\",\"@type\":\"Event\","
                + "\"name\":\"Hadise\",\"startDate\":\"2026-10-02T18:00:00+00:00\","
                + "\"location\":{\"@type\":\"Place\",\"name\":\"Oran Açıkhava Sahnesi\","
                + "\"address\":{\"streetAddress\":\"Oran Mahallesi Kudüs Caddesi No 26/1\",\"addressLocality\":\"Ankara\"},"
                + "\"geo\":{\"latitude\":39.84909305,\"longitude\":32.83251779}},"
                + "\"image\":[\"https://cdn.bubilet.com.tr/files/Etkinlik/hadise-39224.jpg\"],"
                + "\"performer\":[{\"@type\":\"PerformingGroup\",\"name\":\"Hadise\"}]"
                + subEvents + "}</script></html>";
    }

    @Test
    void parsesSessionWithIstanbulWallClockAndStableId() {
        String html = page(",\"subEvent\":[{\"@type\":\"Event\",\"name\":\"Hadise\","
                + "\"startDate\":\"2026-10-02T18:00:00+00:00\","
                + "\"eventStatus\":\"https://schema.org/EventScheduled\","
                + "\"offers\":{\"url\":\"https://www.bubilet.com.tr/ankara/etkinlik/hadise/seans/245435\"}}]");

        List<RawConcertData> records = source.parseEvents(html, PAGE_URL);

        assertEquals(1, records.size());
        RawConcertData raw = records.get(0);
        assertEquals("BUBILET", raw.source());
        assertEquals("hadise@seans245435", raw.sourceEventId());
        assertEquals("Hadise", raw.artistName());
        assertEquals(LocalDateTime.of(2026, 10, 2, 21, 0), raw.startsAt());
        // Seansta konum yoksa ust Event'inki kullanilir.
        assertEquals("Oran Açıkhava Sahnesi", raw.venueName());
        assertEquals("Ankara", raw.city());
        assertEquals(39.84909305, raw.latitude());
        assertEquals(PAGE_URL, raw.ticketUrl());
        assertEquals("https://cdn.bubilet.com.tr/files/Etkinlik/hadise-39224.jpg", raw.imageUrl());
    }

    @Test
    void eachSessionIsSeparateAndCancelledIsSkipped() {
        String html = page(",\"subEvent\":["
                + "{\"startDate\":\"2026-11-01T17:00:00+00:00\",\"offers\":{\"url\":\"x/seans/1\"}},"
                + "{\"startDate\":\"2026-11-02T17:00:00+00:00\",\"offers\":{\"url\":\"x/seans/2\"}},"
                + "{\"startDate\":\"2026-11-03T17:00:00+00:00\",\"eventStatus\":\"https://schema.org/EventCancelled\"}]");

        List<RawConcertData> records = source.parseEvents(html, PAGE_URL);

        assertEquals(List.of("hadise@seans1", "hadise@seans2"),
                records.stream().map(RawConcertData::sourceEventId).toList());
        assertEquals("Hadise", records.get(1).concertName());
    }

    @Test
    void sameTimeSessionsCollapseToOneConcert() {
        String html = page(",\"subEvent\":["
                + "{\"startDate\":\"2026-12-11T13:00:00+00:00\",\"offers\":{\"url\":\"x/seans/10\"}},"
                + "{\"startDate\":\"2026-12-11T13:00:00+00:00\",\"offers\":{\"url\":\"x/seans/11\"}}]");

        List<RawConcertData> records = source.parseEvents(html, PAGE_URL);

        assertEquals(List.of("hadise@seans10"), records.stream().map(RawConcertData::sourceEventId).toList());
    }

    @Test
    void multiPerformerEventIsNotAttributedToFirstArtist() {
        String html = page("")
                .replace("[{\"@type\":\"PerformingGroup\",\"name\":\"Hadise\"}]",
                        "[{\"name\":\"Hadise\"},{\"name\":\"Edis\"}]")
                .replace("\"name\":\"Hadise\",\"startDate\"", "\"name\":\"Wonder Village\",\"startDate\"");

        RawConcertData raw = source.parseEvents(html, PAGE_URL).get(0);

        assertEquals("Wonder Village", raw.concertName());
        assertEquals("Wonder Village", raw.artistName());
    }

    @Test
    void placeholderPerformerFallsBackToEventName() {
        String html = page("").replace("\"name\":\"Hadise\"}]", "\"name\":\"Sanatçı\"}]")
                .replace("\"name\":\"Hadise\",\"startDate\"", "\"name\":\"90'lar Türkçe Pop Partisi\",\"startDate\"");

        assertEquals("90'lar Türkçe Pop Partisi", source.parseEvents(html, PAGE_URL).get(0).artistName());
    }

    @Test
    void withoutSessionsUsesTopLevelEvent() {
        List<RawConcertData> records = source.parseEvents(page(""), PAGE_URL);

        assertEquals(1, records.size());
        assertEquals("hadise@2026-10-02T21:00", records.get(0).sourceEventId());
    }

    @Test
    void extractsOnlyThisCitysEventLinksOnce() {
        String html = "<a href=\"/ankara/etkinlik/hadise\"></a><a href=\"/ankara/etkinlik/hadise\"></a>"
                + "<a href=\"/istanbul/etkinlik/baska\"></a><a href=\"/ankara/etiket/konser\"></a>"
                + "<a href=\"/ankara/etkinlik/mabel-matiz\"></a>";

        assertEquals(List.of(
                        "https://www.bubilet.com.tr/ankara/etkinlik/hadise",
                        "https://www.bubilet.com.tr/ankara/etkinlik/mabel-matiz"),
                BubiletSource.extractEventUrls(html, "ankara"));
    }
}
