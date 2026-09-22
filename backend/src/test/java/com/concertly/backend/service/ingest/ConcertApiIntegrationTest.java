package com.concertly.backend.service.ingest;

import com.concertly.backend.model.Event;
import com.concertly.backend.repository.EventRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Konser API sorgusunun gercek veritabanindaki davranisi.
 *
 * Native SQL kullandigimiz icin (Turkce karakter katlamasi) bunu ancak gercek
 * Postgres uzerinde dogrulayabiliyoruz.
 *
 * Calistirma:
 *   ./mvnw test -Dtest=ConcertApiIntegrationTest -Dconcerts.api=true -DfailIfNoTests=false
 */
@SpringBootTest
@EnabledIfSystemProperty(named = "concerts.api", matches = "true")
class ConcertApiIntegrationTest {

    @Autowired private EventRepository eventRepository;

    private Page<Event> search(String city, String artist, int page, int size) {
        return search(city, artist, false, page, size);
    }

    private Page<Event> search(String city, String artist, boolean past, int page, int size) {
        Sort sort = Sort.by(past ? Sort.Direction.DESC : Sort.Direction.ASC, "event_date");
        return eventRepository.searchConcerts(city, artist, LocalDateTime.now(), past,
                PageRequest.of(page, size, sort));
    }

    /** Gecmis konserler modu: mobil ekranin "gecmis" sekmesi buna dayaniyor. */
    @Test
    void listsPastConcertsNewestFirst() {
        Page<Event> past = search(null, null, true, 0, 10);
        System.out.println("GET /api/concerts?past=true   -> toplam " + past.getTotalElements());

        assertTrue(past.getTotalElements() > 0, "Gecmis konser bulunmali");
        assertTrue(past.getContent().stream()
                        .allMatch(e -> e.getEventDate().isBefore(LocalDateTime.now())),
                "Yaklasan etkinlik donmemeli");
        assertTrue(past.getContent().get(0).getEventDate()
                        .isAfter(past.getContent().get(past.getNumberOfElements() - 1).getEventDate()),
                "En yeni once siralanmali");
    }

    @Test
    void listsUpcomingConcertsWithPagination() {
        Page<Event> first = search(null, null, 0, 10);

        System.out.println();
        System.out.println("GET /api/concerts            -> toplam " + first.getTotalElements()
                + ", sayfa " + first.getTotalPages() + ", bu sayfada " + first.getNumberOfElements());
        first.getContent().stream().limit(3).forEach(e -> System.out.println(
                "   " + e.getEventDate() + " | "
                + (e.getArtist() != null ? e.getArtist().getName() : "-") + " | "
                + (e.getVenue() != null ? e.getVenue().getCity() : "-")));

        assertTrue(first.getTotalElements() > 0, "Yaklasan konser bulunmali");
        assertTrue(first.getNumberOfElements() <= 10);
        assertTrue(first.getContent().stream()
                .allMatch(e -> e.getEventDate().isAfter(LocalDateTime.now().minusMinutes(1))),
                "Gecmis etkinlik donmemeli");

        Page<Event> second = search(null, null, 1, 10);
        assertNotEquals(first.getContent().get(0).getId(), second.getContent().get(0).getId(),
                "Ikinci sayfa farkli kayitlar dondurmeli");
    }

    /** Sehir suzgeci Turkce karakter ve buyuk/kucuk harf farkina duyarsiz olmali. */
    @Test
    void filtersByCityIgnoringTurkishCharacters() {
        long dotted = search("İstanbul", null, 0, 5).getTotalElements();
        long plain = search("istanbul", null, 0, 5).getTotalElements();
        long upper = search("ISTANBUL", null, 0, 5).getTotalElements();

        System.out.println("city=İstanbul -> " + dotted + " | istanbul -> " + plain
                + " | ISTANBUL -> " + upper);

        assertTrue(dotted > 0, "Istanbul icin konser bulunmali");
        assertEquals(dotted, plain, "Noktali/noktasiz I ayni sonucu vermeli");
        assertEquals(dotted, upper, "Buyuk/kucuk harf ayni sonucu vermeli");

        assertTrue(search("İstanbul", null, 0, 50).getContent().stream()
                        .allMatch(e -> e.getVenue() != null
                                && e.getVenue().getCity().toLowerCase().contains("stanbul")),
                "Sonuclarin hepsi Istanbul olmali");
    }

    @Test
    void filtersByArtistName() {
        Page<Event> ankara = search("Ankara", null, 0, 5);
        assertTrue(ankara.getTotalElements() > 0, "Ankara icin konser bulunmali");

        String artistName = ankara.getContent().stream()
                .filter(e -> e.getArtist() != null)
                .map(e -> e.getArtist().getName())
                .findFirst().orElse(null);
        assertNotNull(artistName, "Ornek sanatci bulunamadi");

        Page<Event> byArtist = search(null, artistName, 0, 20);
        System.out.println("artist=" + artistName + " -> " + byArtist.getTotalElements() + " konser");

        assertTrue(byArtist.getTotalElements() > 0);
        assertTrue(byArtist.getContent().stream()
                        .allMatch(e -> e.getArtist() != null
                                && e.getArtist().getName().toLowerCase()
                                        .contains(artistName.toLowerCase().substring(0, 3))),
                "Sonuclar aranan sanatciyi icermeli");
    }

    @Test
    void combinesCityAndArtistFilters() {
        Page<Event> combined = search("Ankara", "a", 0, 10);
        assertTrue(combined.getContent().stream()
                        .allMatch(e -> e.getVenue() != null
                                && e.getVenue().getCity().toLowerCase().contains("ankara")),
                "Sehir suzgeci sanatci ile birlikte de gecerli olmali");
    }
}
