package com.concertly.backend.service.ingest;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Zorlu PSM okuyucusu: gerçek sayfadan alınmış örnekle (6 Eki 2026). */
class ZorluPsmSourceTest {

    private static final String PAGE = "https://www.zorlupsm.com/etkinlikler/garanti-bbva-genc-konserleri-neo-turkish-psych-by-gaye-su-akyol";

    private static String fixture() throws Exception {
        return Files.readString(Path.of("src/test/resources/fixtures/sources/zorlu-event.html"), StandardCharsets.UTF_8);
    }

    @Test
    void concertPageIsParsedWithFixedVenueAndPassoTicket() throws Exception {
        String html = fixture();
        assertTrue(ZorluPsmSource.isConcertPage(html));

        List<RawConcertData> records = ZorluPsmSource.parseEvents(html, PAGE);
        assertEquals(1, records.size());
        RawConcertData r = records.get(0);
        assertEquals("ZORLU_PSM", r.source());
        assertEquals(LocalDateTime.of(2026, 11, 21, 21, 0), r.startsAt());
        assertEquals("Zorlu PSM", r.venueName());
        assertEquals("İstanbul", r.city());
        assertTrue(r.hasCoordinates());
        // Büyük harfli ad, açıklamadaki doğru yazımla değiştirilir
        assertEquals("Garanti BBVA Genç Konserleri: Neo Turkish Psych by Gaye Su Akyol", r.concertName());
        // Satın alma Zorlu sayfasındaki seans adresinden başlıyor (ödeme Passo'da)
        assertTrue(r.ticketUrl().startsWith(PAGE + "?p="), r.ticketUrl());
        assertEquals("garanti-bbva-genc-konserleri-neo-turkish-psych-by-gaye-su-akyol@p38e59de7-d7d0-402c-9c6d-eeba956cc013",
                r.sourceEventId(), "seans kodu tarih değişse de sabit kalır");
        assertFalse(r.cancelled());
    }

    @Test
    void menuLinksAloneDoNotMakeAPageAConcert() {
        // Menüde her sayfada "KONSER" linki var; yalnız üst bilgi kutusundaki etiket sayılır
        String theatre = "<ul><li><a href=\"/etkinlikler/konser\">KONSER</a></li></ul>"
                + "<div class=\"event-detail-info-item-header\"><div><a href=\"/etkinlikler/tiyatro\">"
                + "<span class=\"btn label\">TİYATRO</span></a></div><h1>Şehirde Kimse Yokken</h1>";
        assertFalse(ZorluPsmSource.isConcertPage(theatre));
    }

    @Test
    void pastEventPageWithoutStructuredDataYieldsNothing() {
        assertEquals(List.of(), ZorluPsmSource.parseEvents("<html><h1>Geçmiş</h1></html>", PAGE));
    }

    @Test
    void sitemapSkipsCategoryPagesAndPutsNewestFirst() {
        String xml = "<url><loc>https://www.zorlupsm.com/etkinlikler/konser</loc><lastmod>2026-10-05</lastmod></url>"
                + "<url><loc>https://www.zorlupsm.com/etkinlikler/eski-oyun</loc><lastmod>2024-01-02</lastmod></url>"
                + "<url><loc>https://www.zorlupsm.com/etkinlikler/yeni-konser</loc><lastmod>2026-10-01</lastmod></url>"
                + "<url><loc>https://www.zorlupsm.com/kampanyalar/x</loc><lastmod>2026-10-05</lastmod></url>";
        assertEquals(List.of("https://www.zorlupsm.com/etkinlikler/yeni-konser",
                        "https://www.zorlupsm.com/etkinlikler/eski-oyun"),
                ZorluPsmSource.extractSitemapEventUrls(xml));
    }

    @Test
    void shoutingNamesAreTitleCasedPerWordLanguage() {
        assertEquals("Emir Ersoy \"Cuban Ballads\"", ZorluPsmSource.clean("EMİR ERSOY &quot;CUBAN BALLADS&quot;"));
        assertEquals("Işıl Ve İlkay", ZorluPsmSource.titleCaseTr("IŞIL VE İLKAY"));
        // İngilizce kelime Türkçe kuralla küçültülmez ("Nıght" olmaz)
        assertEquals("The Cinematic Orchestra", ZorluPsmSource.titleCaseTr("THE CINEMATIC ORCHESTRA"));
        assertEquals("Bekir Ünlüataer 'Geçen Yüzyıl'", ZorluPsmSource.clean("BEKİR ÜNLÜATAER &#x27;GEÇEN YÜZYIL&#x27;"));
        assertEquals("Karışık yazım Aynen", ZorluPsmSource.clean("Karışık yazım Aynen"));
    }

    @Test
    void properCasingIsTakenFromTheDescriptionWhenPresent() {
        assertEquals("Dhafer Youssef “Shiraz”",
                ZorluPsmSource.properName("DHAFER YOUSSEF “SHIRAZ”", "Tunuslu ud virtüözü Dhafer Youssef “Shiraz” ile İstanbul'da."));
        assertEquals("İlhan Erşahin's Istanbul Sessions",
                ZorluPsmSource.properName("İLHAN ERŞAHİN'S ISTANBUL SESSIONS", "Bu akşam İlhan Erşahin's Istanbul Sessions sahnede."));
    }
}
