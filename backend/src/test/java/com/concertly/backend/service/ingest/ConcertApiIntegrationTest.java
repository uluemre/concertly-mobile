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
    @Autowired private com.concertly.backend.controller.ConcertController concertController;
    @Autowired private com.concertly.backend.service.EventService eventService;

    @SuppressWarnings("unchecked")
    private java.util.List<com.concertly.backend.dto.response.ConcertResponse> allCards(String city, String artist) {
        java.util.List<com.concertly.backend.dto.response.ConcertResponse> all = new java.util.ArrayList<>();
        for (int page = 0; page < 30; page++) {
            java.util.Map<String, Object> body = concertController.list(city, artist, false, page, 100);
            all.addAll((java.util.List<com.concertly.backend.dto.response.ConcertResponse>) body.get("content"));
            if (Boolean.TRUE.equals(body.get("last"))) break;
        }
        return all;
    }

    /** Istenen 5 senaryo, gercek (yerel) veride. */
    @Test
    void ticketSourceScenariosOnRealData() {
        var cards = allCards(null, null);
        java.util.function.Function<com.concertly.backend.dto.response.ConcertResponse, java.util.List<String>> labels =
                c -> c.getTicketLinks().stream().map(com.concertly.backend.dto.response.ConcertResponse.TicketLink::label).toList();

        // 1) Biletix + Biletinial ayni konser: tek kart, iki secenek
        var sami = allCards("Ankara", "Sami Yusuf").stream()
                .filter(c -> c.getEventDate().toLocalDate().equals(java.time.LocalDate.of(2026, 9, 24))).toList();
        assertEquals(1, sami.size(), "Sami Yusuf 24 Eylul tek kart olmali");
        assertEquals(java.util.Set.of("Biletix", "Biletinial"), new java.util.HashSet<>(labels.apply(sami.get(0))));

        // 2) ve 3) Tek kaynakli konserler tek secenekle
        assertTrue(cards.stream().anyMatch(c -> labels.apply(c).equals(java.util.List.of("Biletix"))), "yalniz Biletix");
        assertTrue(cards.stream().anyMatch(c -> labels.apply(c).equals(java.util.List.of("Biletinial"))), "yalniz Biletinial");

        // 4) Ticketmaster + baska kaynak: asil kayit Ticketmaster'in karti, secenekler birlikte
        long multi = cards.stream().filter(c -> labels.apply(c).size() > 1).count();
        assertTrue(multi > 0);
        for (var c : cards) {
            var l = labels.apply(c);
            assertEquals(new java.util.HashSet<>(l).size(), l.size(), "ayni site iki kez secenek olmamali: " + c.getId() + " " + l);
        }

        // 5) Gercekten farkli konserler: ayni gun iki seans ayri kalir
        var gamze = allCards(null, "Gamze Karta").stream()
                .filter(c -> c.getEventDate().toLocalDate().equals(java.time.LocalDate.of(2026, 9, 27))).toList();
        assertEquals(2, gamze.size(), "14:00 ve 17:00 seanslari iki ayri konser");

        // Ana sayfa / harita listesi de ayni kurali kullanir
        var home = eventService.getAllEvents("Ankara").stream()
                .filter(e -> "Sami Yusuf".equals(e.getArtistName())
                        && e.getEventDate().toLocalDate().equals(java.time.LocalDate.of(2026, 9, 24))).toList();
        assertEquals(1, home.size(), "ana sayfa listesinde de tek kart");
        assertEquals(7336L, home.get(0).getId(), "asil kayit Ticketmaster (merge kuraliyla ayni)");

        System.out.println("Senaryolar: coklu kaynakli kart " + multi + ", toplam kart " + cards.size());
    }

    /**
     * Mobilin yaptigi gibi tum sayfalar: ayni id iki kez gelmemeli, ayni
     * konserin kopyalari (STRONG eslesme) tek kart olmali, sayfalar arasi
     * siralama bozulmamali.
     */
    @Test
    @SuppressWarnings("unchecked")
    void listingHasNoRepeatedIdsAndCollapsesStrongCopies() {
        java.util.List<com.concertly.backend.dto.response.ConcertResponse> all = new java.util.ArrayList<>();
        for (int page = 0; page < 30; page++) {
            java.util.Map<String, Object> body = concertController.list(null, null, false, page, 100);
            all.addAll((java.util.List<com.concertly.backend.dto.response.ConcertResponse>) body.get("content"));
            if (Boolean.TRUE.equals(body.get("last"))) break;
        }
        java.util.Set<Long> ids = new java.util.HashSet<>();
        for (var c : all) assertTrue(ids.add(c.getId()), "ayni kayit iki kez: " + c.getId());

        java.util.Map<String, Long> keys = new java.util.HashMap<>();
        int sameKey = 0;
        for (var c : all) {
            String k = EventMatcher.normalize(c.getArtistName()) + "|" + c.getEventDate() + "|"
                    + EventMatcher.normalize(c.getVenueName()) + "|" + EventMatcher.normalize(c.getVenueCity());
            if (keys.put(k, c.getId()) != null) sameKey++;
        }
        long multi = all.stream().filter(c -> c.getTicketLinks().size() > 1).count();
        System.out.println("GET /api/concerts (tum sayfalar) -> " + all.size() + " kart, birden cok bilet kaynagi: "
                + multi + ", ayni sanatci+saat+mekan kalan: " + sameKey);
        assertEquals(0, sameKey, "birebir ayni konser iki kart olmamali");
        for (int i = 1; i < all.size(); i++) {
            assertFalse(all.get(i).getEventDate().isBefore(all.get(i - 1).getEventDate()), "tarih sirasi bozuldu");
        }
    }

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
