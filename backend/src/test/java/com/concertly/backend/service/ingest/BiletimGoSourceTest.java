package com.concertly.backend.service.ingest;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** BiletimGo HTML okuyucusu: gerçek sayfadan kırpılmış örnekle (6 Eki 2026). */
class BiletimGoSourceTest {

    private static final String PAGE = "https://www.biletimgo.com/etkinlik/bahadir-macit-istanbul-konseri-31488";

    private static String fixture() throws Exception {
        return Files.readString(Path.of("src/test/resources/fixtures/sources/biletimgo-event.html"), StandardCharsets.UTF_8);
    }

    @Test
    void eventPageIsParsed() throws Exception {
        RawConcertData r = BiletimGoSource.parseEvent(fixture(), PAGE);
        assertNotNull(r);
        assertEquals("BILETIMGO", r.source());
        assertEquals("31488", r.sourceEventId());
        assertEquals(LocalDateTime.of(2026, 10, 28, 22, 0), r.startsAt());
        assertEquals("BeerPort Coctail House", r.venueName());
        assertEquals("İstanbul", r.city());
        assertTrue(r.venueAddress().contains("Beşiktaş"));
        assertEquals("Bahadır Macit İstanbul Konseri", r.concertName());
        assertEquals("Bahadır Macit", r.artistName(), "sanatçı başlıktaki şehir ve 'Konseri' ekinden ayrılır");
        assertTrue(r.imageUrl().startsWith("https://www.biletimgo.com/images/"));
        assertEquals(PAGE, r.ticketUrl());
        assertTrue(r.isUsable());
    }

    @Test
    void pageWithoutTheInfoBoxIsSkipped() {
        assertNull(BiletimGoSource.parseEvent("<html><meta property=\"og:title\" content=\"X\"></html>", PAGE));
    }

    @Test
    void calendarLinksAreUniqueAndAbsolute() {
        String html = "<a href=\"etkinlik/dipses-konseri-30846\">x</a><a href=\"../etkinlik/dipses-konseri-30846\">"
                + "<a href=\"https://www.biletimgo.com/etkinlik/siren-konseri-30060\">";
        assertEquals(List.of("https://www.biletimgo.com/etkinlik/dipses-konseri-30846",
                        "https://www.biletimgo.com/etkinlik/siren-konseri-30060"),
                BiletimGoSource.extractEventUrls(html));
    }

    @Test
    void turkishDateTextIsParsed() {
        assertEquals(LocalDateTime.of(2026, 3, 9, 20, 30), BiletimGoSource.parseDate(" Mart 9, 2026 20:30 "));
        assertEquals(LocalDateTime.of(2026, 12, 31, 23, 0), BiletimGoSource.parseDate("Aralık 31, 2026 23:00"));
        assertNull(BiletimGoSource.parseDate("Yakında"));
    }

    @Test
    void artistIsTakenFromTitle() {
        assertEquals("Siren", BiletimGoSource.artistFromTitle("Siren Konseri", "İstanbul"));
        assertEquals("Meteora Linkin Park Tribute", BiletimGoSource.artistFromTitle("Meteora Linkin Park Tribute", "İstanbul"));
        assertEquals("Gece Yolcuları If Beşiktaş", BiletimGoSource.artistFromTitle("Gece Yolcuları If Beşiktaş Konseri", "İstanbul"));
        // Gerçek BiletimGo başlıkları (6 Eki 2026)
        assertEquals("Waidmann", BiletimGoSource.artistFromTitle(
                "Waidmann @ Rocknrolla Kadıköy Live 10.10.2026", "İstanbul", "RocknRolla Live Kadıköy"));
        assertEquals("Melankoli", BiletimGoSource.artistFromTitle(
                "Melankoli Konseri | Haymatlos Mekan", "Ankara", "Haymatlos Mekan"));
        assertEquals("Mansur Ark & Dj Fikret Kocamaz", BiletimGoSource.artistFromTitle(
                "Mansur Ark & Dj Fikret Kocamaz - İstanbul", "İstanbul", "Hayal Kahvesi Bahçeşehir"));
        assertEquals("Murat Bolat ve Anadolu Retrosu", BiletimGoSource.artistFromTitle(
                "Murat Bolat ve Anadolu Retrosu Ankara Konseri", "Ankara", "IF Performance Hall Ankara"));
        assertEquals("WHITEPONY – Nu Metal Night", BiletimGoSource.artistFromTitle(
                "WHITEPONY – Nu Metal Night | Ankara", "Ankara", "Manhattan Bar Ankara"));
        // Ayraçtan sonrası yer değilse dokunulmaz
        assertEquals("Turkish Therapy | Berat Mert Demir", BiletimGoSource.artistFromTitle(
                "Turkish Therapy | Berat Mert Demir", "Ankara", "JW Marriott Hotel Ankara"));
    }
}
