package com.concertly.backend.service.ingest;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.web.client.RestTemplateBuilder;

import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * ASAMA 2 prototipi: Biletinial -> JSON-LD -> RawConcertData -> konsol.
 *
 * Gercek siteye istek attigi icin normal test kosusunda KAPALIDIR; yalnizca
 * -Dbiletinial.prototype=true verildiginde calisir. Boylece mvnw test aginda
 * dis servise bagimli hale gelmez.
 *
 * Calistirma:
 *   ./mvnw test -Dtest=BiletinialSourcePrototypeTest -Dbiletinial.prototype=true -DfailIfNoTests=false
 */
@EnabledIfSystemProperty(named = "biletinial.prototype", matches = "true")
class BiletinialSourcePrototypeTest {

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm");

    @Test
    void fetchesRealConcertsAndPrintsThem() {
        String cities = System.getProperty("biletinial.cities", "ankara,istanbul");
        int perCity = Integer.getInteger("biletinial.perCity", 3);

        BiletinialSource source = new BiletinialSource(
                new RestTemplateBuilder(),
                "ConcertlyBot/0.1 (+https://concertly-api.onrender.com/promo/)",
                800,
                2);

        List<RawConcertData> all = new ArrayList<>();
        for (String city : cities.split(",")) {
            String slug = city.trim();
            if (slug.isEmpty()) continue;
            List<RawConcertData> found = source.fetchCity(slug, perCity);
            System.out.println();
            System.out.println("### " + slug.toUpperCase() + " -> " + found.size() + " ham kayit");
            all.addAll(found);
        }

        System.out.println();
        System.out.println("=".repeat(78));
        System.out.println("ORNEK KAYITLAR");
        System.out.println("=".repeat(78));
        all.stream().limit(8).forEach(r -> {
            System.out.println("Artist      : " + r.artistName());
            System.out.println("Concert     : " + r.concertName());
            System.out.println("Date/Time   : " + (r.startsAt() != null ? r.startsAt().format(TS) : "-"));
            System.out.println("Venue       : " + r.venueName());
            System.out.println("City        : " + r.city());
            System.out.println("Latitude    : " + r.latitude());
            System.out.println("Longitude   : " + r.longitude());
            System.out.println("Ticket URL  : " + r.ticketUrl());
            System.out.println("Source      : " + r.source());
            System.out.println("-".repeat(78));
        });

        long withCoords = all.stream().filter(RawConcertData::hasCoordinates).count();
        long withArtist = all.stream().filter(r -> r.artistName() != null).count();
        long withCity = all.stream().filter(r -> r.city() != null).count();
        System.out.println("TOPLAM      : " + all.size() + " ham kayit");
        System.out.println("Koordinatli : " + withCoords + "/" + all.size());
        System.out.println("Sanatcili   : " + withArtist + "/" + all.size());
        System.out.println("Sehirli     : " + withCity + "/" + all.size());
        System.out.println("Benzersiz id: " + all.stream().map(RawConcertData::sourceEventId).distinct().count());

        // Windows konsolu Turkce karakterleri kendi kod sayfasiyla basiyor;
        // dogrulanabilir ciktiyi ayrica UTF-8 dosyaya yaziyoruz.
        writeUtf8Report(all);

        assertFalse(all.isEmpty(), "Biletinial hic kayit dondurmedi");
        assertTrue(all.stream().allMatch(RawConcertData::isUsable), "Kullanilamaz kayit var");
    }

    /** Kayitlari target/biletinial-prototype.txt dosyasina UTF-8 olarak yazar. */
    private void writeUtf8Report(List<RawConcertData> all) {
        Path out = Path.of("target", "biletinial-prototype.txt");
        try {
            Files.createDirectories(out.getParent());
            try (PrintWriter w = new PrintWriter(Files.newBufferedWriter(out, StandardCharsets.UTF_8))) {
                for (RawConcertData r : all) {
                    w.println("Artist      : " + r.artistName());
                    w.println("Concert     : " + r.concertName());
                    w.println("Date/Time   : " + (r.startsAt() != null ? r.startsAt().format(TS) : "-"));
                    w.println("Venue       : " + r.venueName());
                    w.println("City        : " + r.city());
                    w.println("Latitude    : " + r.latitude());
                    w.println("Longitude   : " + r.longitude());
                    w.println("Ticket URL  : " + r.ticketUrl());
                    w.println("Source      : " + r.source());
                    w.println("-".repeat(78));
                }
            }
            System.out.println("UTF-8 rapor : " + out.toAbsolutePath());
        } catch (Exception e) {
            System.out.println("Rapor yazilamadi: " + e.getMessage());
        }
    }
}
