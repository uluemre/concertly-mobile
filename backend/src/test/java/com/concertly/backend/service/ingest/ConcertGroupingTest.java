package com.concertly.backend.service.ingest;

import com.concertly.backend.dto.response.ConcertResponse;
import com.concertly.backend.model.Artist;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventSource;
import com.concertly.backend.model.EventSourceLink;
import com.concertly.backend.model.Venue;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Konser listesinde ayni konserin kopyalari tek kart olmali; farkli seanslar
 * ve farkli konserler ayri kalmali. Veri degismez.
 */
class ConcertGroupingTest {

    private final ConcertGrouping grouping =
            new ConcertGrouping(new EventMatcher(120, 75), new EventMergeService(null, null));

    private static Event event(long id, String artist, String venue, String city, String iso,
                               EventSource source, String ticketUrl) {
        Artist a = new Artist();
        a.setName(artist);
        Venue v = new Venue();
        v.setName(venue);
        v.setCity(city);
        Event e = new Event();
        ReflectionTestUtils.setField(e, "id", id);
        e.setArtist(a);
        e.setVenue(v);
        e.setEventDate(LocalDateTime.parse(iso));
        e.setSource(source);
        e.setTicketUrl(ticketUrl);
        e.setName(artist);
        return e;
    }

    private static EventSourceLink link(Event e, EventSource s, String url, LocalDateTime seen, boolean primary) {
        EventSourceLink l = new EventSourceLink();
        l.setEvent(e);
        l.setSource(s);
        l.setExternalId(s + "-" + e.getId());
        l.setTicketUrl(url);
        l.setLastSeenAt(seen);
        l.setIsPrimary(primary);
        return l;
    }

    @Test
    void ticketmasterAndBiletinialCopiesBecomeOneCardWithTicketmasterAsCanonical() {
        Event bi = event(9503, "Serdar Ortaç", "JJ Arena Ataşehir", "İstanbul", "2026-09-25T21:00",
                EventSource.BILETINIAL, "https://biletinial.com/tr-tr/muzik/serdar");
        Event tm = event(8376, "Serdar Ortaç", "JJ Arena Ataşehir", "Istanbul", "2026-09-25T21:00",
                EventSource.TICKETMASTER, "https://www.biletix.com/etkinlik/X1");

        Map<Long, ConcertGrouping.Group> g = grouping.group(List.of(bi, tm));

        assertSame(g.get(9503L), g.get(8376L));
        assertEquals(8376L, g.get(9503L).canonical().getId(), "Ticketmaster asil kayit (merge kuraliyla ayni)");
    }

    @Test
    void sameSourceDuplicateIdsCollapseTransitively() {
        Event a = event(8384, "Koray Avcı", "Ataköy Marina Açık Hava Sahnesi", "İstanbul", "2026-09-25T21:00",
                EventSource.TICKETMASTER, "https://www.biletix.com/a");
        Event b = event(8750, "Koray Avcı", "Ataköy Marina Açık Hava Sahnesi", "İstanbul", "2026-09-25T21:00",
                EventSource.TICKETMASTER, "https://www.biletix.com/b");
        Event c = event(8751, "Koray Avcı", "Ataköy Marina Açık Hava Sahnesi", "İstanbul", "2026-09-25T21:00",
                EventSource.TICKETMASTER, "https://www.biletix.com/c");

        Map<Long, ConcertGrouping.Group> g = grouping.group(List.of(c, a, b));

        assertEquals(3, g.get(8750L).members().size());
        assertEquals(8384L, g.get(8751L).canonical().getId(), "en eski kayit asil");
    }

    @Test
    void separateShowsAndDifferentCitiesStaySeparate() {
        Event matinee = event(8436, "Gamze Karta", "Trump Stage", "İstanbul", "2026-09-27T14:00",
                EventSource.TICKETMASTER, null);
        Event evening = event(8437, "Gamze Karta", "Trump Stage", "İstanbul", "2026-09-27T17:00",
                EventSource.TICKETMASTER, null);
        Event otherCity = event(9504, "Serdar Ortaç", "Jolly Joker", "Mersin", "2026-09-25T21:00",
                EventSource.BILETINIAL, null);
        Event istanbul = event(8376, "Serdar Ortaç", "Jolly Joker", "İstanbul", "2026-09-25T21:00",
                EventSource.TICKETMASTER, null);

        Map<Long, ConcertGrouping.Group> g = grouping.group(List.of(matinee, evening, otherCity, istanbul));

        assertNotSame(g.get(8436L), g.get(8437L), "3 saat arayla iki seans ayri konser");
        assertNotSame(g.get(9504L), g.get(8376L), "farkli sehir asla ayni konser degil");
    }

    @Test
    void sameVenueWrittenDifferentlyIsOneCardInTheListing() {
        Event tm = event(7336, "Sami Yusuf", "Congresium Ankara", "Ankara", "2026-09-24T21:00",
                EventSource.TICKETMASTER, null);
        Event bi = event(9428, "Sami Yusuf", "ATO - Congresium Kongre ve Sergi Sarayı", "Ankara", "2026-09-24T21:00",
                EventSource.BILETINIAL, null);
        // Gercek veri: ayni kompleks iki kaynakta ~123 m farkli koordinatla
        tm.getVenue().setLatitude(39.91079);
        tm.getVenue().setLongitude(32.802503);
        bi.getVenue().setLatitude(39.911600930221105);
        bi.getVenue().setLongitude(32.803488453904926);

        Map<Long, ConcertGrouping.Group> g = grouping.group(List.of(tm, bi));

        assertSame(g.get(7336L), g.get(9428L));
        assertEquals(7336L, g.get(9428L).canonical().getId());
    }

    @Test
    void sameVenueUnderAliasNamesIsOneCardEvenWithWrongCoordinates() {
        // Gercek veri (N-08): "Open Air" = "Acikhava"; koordinatlar 2,5 km farkli
        Event tm = event(7879, "Gökhan Türkmen", "Antalya Open Air", "Antalya", "2026-10-03T21:00",
                EventSource.TICKETMASTER, null);
        Event bi = event(9571, "Gökhan Türkmen", "Antalya Açıkhava Tiyatrosu", "Antalya", "2026-10-03T21:00",
                EventSource.BILETINIAL, null);
        tm.getVenue().setLatitude(36.8841); tm.getVenue().setLongitude(30.7056);
        bi.getVenue().setLatitude(36.8900); bi.getVenue().setLongitude(30.6800);
        // "Oran" 4 harf: eski kuraldaki ayirt edici kelime esigine (5) takiliyordu
        Event oranA = event(8474, "Mustafa Sandal", "Oran Açık Hava Sahnesi", "Ankara", "2026-09-29T21:00",
                EventSource.TICKETMASTER, null);
        Event oranB = event(9542, "Mustafa Sandal", "Oran Açikhava Sahnesi", "Ankara", "2026-09-29T21:00",
                EventSource.BILETINIAL, null);
        // Biri digerinin kisa yazimi; koordinat binlerce km yanlis
        Event hsA = event(8593, "Onur Özdemir", "Holly Stone Performance Hall - Adana", "Adana", "2026-10-04T22:00",
                EventSource.TICKETMASTER, null);
        Event hsB = event(9686, "Onur Özdemir", "Holly Stone Adana", "Adana", "2026-10-04T22:00",
                EventSource.BILETINIAL, null);
        hsA.getVenue().setLatitude(37.0); hsA.getVenue().setLongitude(35.3);
        hsB.getVenue().setLatitude(0.0); hsB.getVenue().setLongitude(0.0);
        // Ek almis kelime: "Otopark Alani" / "Otoparki"
        Event anA = event(9007, "Şebnem Ferah", "ANFAŞ Antalya Expo Center Otopark Alanı", "Antalya", "2026-10-10T21:30",
                EventSource.TICKETMASTER, null);
        Event anB = event(9482, "Şebnem Ferah", "ANFAŞ Antalya Expo Center Otoparkı", "Antalya", "2026-10-10T21:30",
                EventSource.BILETINIAL, null);

        Map<Long, ConcertGrouping.Group> g = grouping.group(List.of(tm, bi, oranA, oranB, hsA, hsB, anA, anB));

        assertSame(g.get(7879L), g.get(9571L));
        assertEquals(7879L, g.get(9571L).canonical().getId(), "Ticketmaster asil kayit");
        assertSame(g.get(8474L), g.get(9542L));
        assertSame(g.get(8593L), g.get(9686L));
        assertSame(g.get(9007L), g.get(9482L));
    }

    @Test
    void differentVenuesAtTheSameTimeStaySeparate() {
        // Gercek veri: ayni sanatci ayni saatte ama tamamen farkli mekanlar (belirsiz; birlestirilmez)
        Event a = event(7682, "Pentegram", "Bostancı Showland", "İstanbul", "2026-11-08T21:00",
                EventSource.TICKETMASTER, null);
        Event b = event(9815, "Pentegram", "Harbiye Cemil Topuzlu Açıkhava Tiyatrosu", "İstanbul", "2026-11-08T21:00",
                EventSource.TICKETMASTER, null);
        Event c = event(7653, "Dan Patlansky", "Tosca Play", "Ankara", "2026-10-20T22:00",
                EventSource.TICKETMASTER, null);
        Event d = event(8886, "Dan Patlansky", "Kulüp Müjgan", "Ankara", "2026-10-20T22:00",
                EventSource.TICKETMASTER, null);
        // Tur kelimesi farkli: "Arena" / "Acikhava"
        Event e = event(601, "Test Sanatci", "Ankara Arena", "Ankara", "2026-10-20T21:00",
                EventSource.TICKETMASTER, null);
        Event f = event(602, "Test Sanatci", "Ankara Açıkhava Tiyatrosu", "Ankara", "2026-10-20T21:00",
                EventSource.BILETINIAL, null);
        // Farkli sanatci ayni mekan ayni saat: ayri
        Event h = event(603, "Baska Sanatci", "Oran Açık Hava Sahnesi", "Ankara", "2026-09-29T21:00",
                EventSource.BILETINIAL, null);
        Event i = event(604, "Mustafa Sandal", "Oran Açık Hava Sahnesi", "Ankara", "2026-09-29T21:00",
                EventSource.TICKETMASTER, null);

        Map<Long, ConcertGrouping.Group> g = grouping.group(List.of(a, b, c, d, e, f, h, i));

        assertNotSame(g.get(7682L), g.get(9815L));
        assertNotSame(g.get(7653L), g.get(8886L));
        assertNotSame(g.get(601L), g.get(602L));
        assertNotSame(g.get(603L), g.get(604L));
    }

    @Test
    void withTimeGapOrDifferentBranchesStaysSeparate() {
        // Ortak ayirt edici kelime var ama 2 saat fark: ayri seans olabilir
        Event early = event(9437, "Kadebostany", "Volkswagen Arena Maslak", "İstanbul", "2026-10-02T20:00",
                EventSource.BILETINIAL, null);
        Event late = event(7886, "Kadebostany", "Maslak Volkswagen Sahnesi", "İstanbul", "2026-10-02T22:00",
                EventSource.TICKETMASTER, null);

        // Ortak kelime var ama salonlar 1 km'den uzak: ayni zincirin baska subesi
        Event jjA = event(501, "Mabel Matiz", "Jolly Joker Atakent", "İstanbul", "2026-10-05T21:00",
                EventSource.TICKETMASTER, null);
        Event jjB = event(502, "Mabel Matiz", "Jolly Joker Kadıköy", "İstanbul", "2026-10-05T21:00",
                EventSource.BILETINIAL, null);
        jjA.getVenue().setLatitude(41.02);
        jjA.getVenue().setLongitude(28.66);
        jjB.getVenue().setLatitude(40.99);
        jjB.getVenue().setLongitude(29.03);

        Map<Long, ConcertGrouping.Group> g = grouping.group(List.of(early, late, jjA, jjB));

        assertNotSame(g.get(9437L), g.get(7886L));
        assertNotSame(g.get(501L), g.get(502L));
    }

    @Test
    void groupCardOffersEveryValidTicketSourceCanonicalFirst() {
        Event bi = event(9503, "Serdar Ortaç", "JJ Arena", "İstanbul", "2026-09-25T21:00",
                EventSource.BILETINIAL, "https://biletinial.com/tr-tr/muzik/serdar");
        Event tm = event(8376, "Serdar Ortaç", "JJ Arena", "İstanbul", "2026-09-25T21:00",
                EventSource.TICKETMASTER, "https://www.biletix.com/etkinlik/X1");
        LocalDateTime now = LocalDateTime.now();
        List<EventSourceLink> links = List.of(
                link(bi, EventSource.BILETINIAL, bi.getTicketUrl(), now, true),
                link(tm, EventSource.TICKETMASTER, tm.getTicketUrl(), now, true));

        ConcertResponse card = ConcertResponse.fromGroup(tm, List.of(bi, tm), links);

        assertEquals(8376L, card.getId());
        assertEquals(List.of("Biletix", "Biletinial"),
                card.getTicketLinks().stream().map(ConcertResponse.TicketLink::label).toList());
        assertEquals(tm.getTicketUrl(), card.getTicketUrl());
    }

    @Test
    void sourceNoLongerSeenBySyncIsNotOffered() {
        Event bi = event(9503, "Serdar Ortaç", "JJ Arena", "İstanbul", "2026-09-25T21:00",
                EventSource.BILETINIAL, "https://biletinial.com/eski-adres");
        Event tm = event(8376, "Serdar Ortaç", "JJ Arena", "İstanbul", "2026-09-25T21:00",
                EventSource.TICKETMASTER, "https://www.biletix.com/etkinlik/X1");
        LocalDateTime now = LocalDateTime.now();
        List<EventSourceLink> links = List.of(
                link(bi, EventSource.BILETINIAL, bi.getTicketUrl(), now.minusDays(10), true),
                link(tm, EventSource.TICKETMASTER, tm.getTicketUrl(), now, true));

        List<ConcertResponse.TicketLink> result = ConcertResponse.resolveTicketLinks(List.of(tm, bi), links);

        assertEquals(1, result.size(), "10 gundur gorulmeyen kaynak bayat");
        assertEquals("Biletix", result.get(0).label());
    }

    @Test
    void allLinksOldTogetherAreKeptBecauseComparisonIsRelative() {
        Event tm = event(8376, "Serdar Ortaç", "JJ Arena", "İstanbul", "2026-09-25T21:00",
                EventSource.TICKETMASTER, "https://www.biletix.com/etkinlik/X1");
        LocalDateTime old = LocalDateTime.now().minusDays(20);   // sunucu uzun sure uyudu
        List<EventSourceLink> links = List.of(link(tm, EventSource.TICKETMASTER, tm.getTicketUrl(), old, true));

        assertEquals(1, ConcertResponse.resolveTicketLinks(List.of(tm), links).size());
    }

    // ── Hazir listeler (ana sayfa, harita, sanatci/mekan sayfasi, arama) ──────────

    @Test
    void listCollapsesBiletixAndBiletinialCopyToTheCanonicalKeepingOrder() {
        Event other = event(1, "Duman", "Volkswagen Arena", "İstanbul", "2026-09-20T21:00",
                EventSource.TICKETMASTER, "https://www.biletix.com/d");
        Event bi = event(9428, "Sami Yusuf", "ATO - Congresium Kongre ve Sergi Merkezi", "Ankara", "2026-09-24T21:00",
                EventSource.BILETINIAL, "https://biletinial.com/sami");
        Event tm = event(7336, "Sami Yusuf", "Congresium Ankara", "Ankara", "2026-09-24T21:00",
                EventSource.TICKETMASTER, "https://www.biletix.com/sami");
        Event last = event(2, "Mor ve Ötesi", "Zorlu PSM", "İstanbul", "2026-09-30T21:00",
                EventSource.BILETINIAL, "https://biletinial.com/mor");

        List<Event> out = grouping.collapse(List.of(other, bi, tm, last));

        assertEquals(List.of(1L, 7336L, 2L), out.stream().map(Event::getId).toList(),
                "kopya tek kayit olur, asil kayit (Ticketmaster) kalir, sira bozulmaz");
    }

    @Test
    void singleSourceEventsAreNeverTouched() {
        Event onlyBiletix = event(10, "Duman", "Volkswagen Arena", "İstanbul", "2026-09-20T21:00",
                EventSource.TICKETMASTER, "https://www.biletix.com/d");
        Event onlyBiletinial = event(11, "Mor ve Ötesi", "Zorlu PSM", "İstanbul", "2026-09-20T21:00",
                EventSource.BILETINIAL, "https://biletinial.com/mor");

        assertEquals(List.of(10L, 11L), grouping.collapse(List.of(onlyBiletix, onlyBiletinial))
                .stream().map(Event::getId).toList(), "ayni saat ayni sehir ama farkli sanatci: iki konser");
    }

    @Test
    void whenCanonicalIsNotInTheListTheBestPresentCopyStays() {
        // Mekan sayfasi yalnizca kendi kaydini listeler; asil kayit baska mekan kaydinda
        Event biA = event(9430, "Sami Yusuf", "Istanbul Kongre Merkezi, Harbiye Oditoryumu", "İstanbul",
                "2026-09-28T21:00", EventSource.BILETINIAL, null);
        Event biB = event(9431, "Sami Yusuf", "Istanbul Kongre Merkezi, Harbiye Oditoryumu", "İstanbul",
                "2026-09-28T21:00", EventSource.BILETINIAL, null);

        assertEquals(List.of(9430L), grouping.collapse(List.of(biB, biA)).stream().map(Event::getId).toList());
    }

    @Test
    void ticketmasterPlusOtherSourceCardCarriesAllTicketOptions() {
        Event tm = event(7336, "Sami Yusuf", "Congresium Ankara", "Ankara", "2026-09-24T21:00",
                EventSource.TICKETMASTER, "https://www.biletix.com/sami");
        Event bi = event(9428, "Sami Yusuf", "ATO - Congresium", "Ankara", "2026-09-24T21:00",
                EventSource.BILETINIAL, "https://biletinial.com/sami");
        Event bu = event(9900, "Sami Yusuf", "Congresium", "Ankara", "2026-09-24T21:00",
                EventSource.ADMIN, "https://www.bubilet.com.tr/ankara/etkinlik/sami-yusuf");
        LocalDateTime now = LocalDateTime.now();

        ConcertResponse card = ConcertResponse.fromGroup(tm, List.of(bi, bu, tm), List.of(
                link(tm, EventSource.TICKETMASTER, tm.getTicketUrl(), now, true),
                link(bi, EventSource.BILETINIAL, bi.getTicketUrl(), now, true)));

        assertEquals(List.of("Biletix", "Biletinial", "Bubilet"),
                card.getTicketLinks().stream().map(ConcertResponse.TicketLink::label).toList());
    }
}
