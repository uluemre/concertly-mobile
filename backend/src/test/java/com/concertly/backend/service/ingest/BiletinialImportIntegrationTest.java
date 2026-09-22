package com.concertly.backend.service.ingest;

import com.concertly.backend.model.Event;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.VenueRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.format.DateTimeFormatter;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * ASAMA 3 dogrulamasi: Biletinial -> Concertly modeli -> PostgreSQL.
 *
 * Gercek siteye ve yerel veritabanina dokundugu icin normal test kosusunda
 * KAPALIDIR; yalnizca -Dbiletinial.import=true ile calisir.
 *
 * Calistirma:
 *   ./mvnw test -Dtest=BiletinialImportIntegrationTest -Dbiletinial.import=true -DfailIfNoTests=false
 */
@SpringBootTest
@EnabledIfSystemProperty(named = "biletinial.import", matches = "true")
class BiletinialImportIntegrationTest {

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm");

    @Autowired private BiletinialSource source;
    @Autowired private BiletinialImportService importService;
    @Autowired private EventRepository eventRepository;
    @Autowired private ArtistRepository artistRepository;
    @Autowired private VenueRepository venueRepository;

    @Test
    void importsOnceThenStaysIdempotent() {
        String citySlug = System.getProperty("biletinial.city", "ankara");
        int pages = Integer.getInteger("biletinial.pages", 4);

        long eventsBefore = eventRepository.count();
        long artistsBefore = artistRepository.count();
        long venuesBefore = venueRepository.count();
        long foreignBefore = countNonBiletinial();

        // Ag maliyetini ikiye katlamamak icin kayitlar BIR KEZ cekilir,
        // ayni liste iki kez yazilir: mukerrer kontrolu boyle sinanir.
        List<RawConcertData> records = source.fetchCity(citySlug, pages);
        assertFalse(records.isEmpty(), "Biletinial hic kayit dondurmedi");

        BiletinialImportService.ImportResult first = importService.importRecords(records);
        long eventsAfterFirst = eventRepository.count();
        long artistsAfterFirst = artistRepository.count();
        long venuesAfterFirst = venueRepository.count();

        BiletinialImportService.ImportResult second = importService.importRecords(records);
        long eventsAfterSecond = eventRepository.count();
        long artistsAfterSecond = artistRepository.count();
        long venuesAfterSecond = venueRepository.count();
        long foreignAfter = countNonBiletinial();

        System.out.println();
        System.out.println("=".repeat(74));
        System.out.println("BILETINIAL ICE AKTARIM DOGRULAMASI (" + citySlug + ", " + pages + " sayfa)");
        System.out.println("=".repeat(74));
        System.out.println("Cekilen ham kayit      : " + records.size());
        System.out.println("1. sync  created/updated: " + first.created() + " / " + first.updated()
                + "  (atlanan " + first.skipped() + ")");
        System.out.println("2. sync  created/updated: " + second.created() + " / " + second.updated()
                + "  (atlanan " + second.skipped() + ")");
        System.out.println("-".repeat(74));
        System.out.println("events  : " + eventsBefore + " -> " + eventsAfterFirst + " -> " + eventsAfterSecond);
        System.out.println("artists : " + artistsBefore + " -> " + artistsAfterFirst + " -> " + artistsAfterSecond);
        System.out.println("venues  : " + venuesBefore + " -> " + venuesAfterFirst + " -> " + venuesAfterSecond);
        System.out.println("Biletinial disi etkinlik: " + foreignBefore + " -> " + foreignAfter);
        System.out.println("-".repeat(74));

        importService.importedEvents().stream()
                .sorted((a, b) -> b.getId().compareTo(a.getId()))
                .limit(5)
                .forEach(e -> System.out.println(
                        "#" + e.getId()
                        + " | " + (e.getArtist() != null ? e.getArtist().getName() : "-")
                        + " | " + (e.getEventDate() != null ? e.getEventDate().format(TS) : "-")
                        + " | " + (e.getVenue() != null ? e.getVenue().getName() : "-")
                        + " | " + (e.getVenue() != null ? e.getVenue().getCity() : "-")
                        + " | source=" + e.getSource()
                        + " | " + e.getExternalId()));
        System.out.println("=".repeat(74));

        // 1) Ilk sync kayit olusturdu mu (ya da zaten hepsi vardi)
        assertEquals(records.size(), first.created() + first.updated(), "Kayitlarin hepsi islenmeli");

        // 2) Ikinci sync mukerrer olusturmamali
        assertEquals(0, second.created(), "Ikinci sync yeni kayit olusturmamali");
        assertEquals(eventsAfterFirst, eventsAfterSecond, "Ikinci sync event sayisini degistirmemeli");

        // 3) Artist / Venue tekrar kullanilmali
        assertEquals(artistsAfterFirst, artistsAfterSecond, "Ikinci sync yeni sanatci acmamali");
        assertEquals(venuesAfterFirst, venuesAfterSecond, "Ikinci sync yeni mekan acmamali");

        // 4) Ticketmaster ve diger kaynaklar etkilenmemeli
        assertEquals(foreignBefore, foreignAfter, "Biletinial disi etkinlik sayisi degismemeli");

        // Kaynak isareti kayitta gorunur olmali
        assertTrue(importService.importedEvents().stream()
                        .allMatch(e -> "BILETINIAL".equals(String.valueOf(e.getSource()))),
                "Tum Biletinial kayitlari source=BILETINIAL olmali");
    }

    private long countNonBiletinial() {
        return eventRepository.findAll().stream()
                .filter(e -> e.getExternalId() == null
                        || !e.getExternalId().startsWith(BiletinialImportService.EXTERNAL_ID_PREFIX))
                .count();
    }
}
