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
    void sameArtistAtTheSameTimeInTwoVenuesIsOneConcert() {
        // Gercek veri: ayni sanatci ayni saatte iki farkli mekanda — olamaz, tek konser gosterilir
        Event a = event(7682, "Pentegram", "Bostancı Showland", "İstanbul", "2026-11-08T21:00",
                EventSource.TICKETMASTER, null);
        Event b = event(9815, "Pentegram", "Harbiye Cemil Topuzlu Açıkhava Tiyatrosu", "İstanbul", "2026-11-08T21:00",
                EventSource.TICKETMASTER, null);
        Event c = event(7653, "Dan Patlansky", "Tosca Play", "Ankara", "2026-10-20T22:00",
                EventSource.TICKETMASTER, null);
        Event d = event(8886, "Dan Patlansky", "Kulüp Müjgan", "Ankara", "2026-10-20T22:00",
                EventSource.TICKETMASTER, null);
        // Tur kelimesi farkli: "Arena" / "Acikhava" — ayni kaynak, ikisi de gercek saat (belirsiz)
        Event e = event(601, "Test Sanatci", "Ankara Arena", "Ankara", "2026-10-20T21:00",
                EventSource.TICKETMASTER, null);
        Event f = event(602, "Test Sanatci", "Ankara Açıkhava Tiyatrosu", "Ankara", "2026-10-20T21:00",
                EventSource.TICKETMASTER, null);
        // Farkli sanatci ayni mekan ayni saat: ayri
        Event h = event(603, "Baska Sanatci", "Oran Açık Hava Sahnesi", "Ankara", "2026-09-29T21:00",
                EventSource.BILETINIAL, null);
        Event i = event(604, "Mustafa Sandal", "Oran Açık Hava Sahnesi", "Ankara", "2026-09-29T21:00",
                EventSource.TICKETMASTER, null);

        Map<Long, ConcertGrouping.Group> g = grouping.group(List.of(a, b, c, d, e, f, h, i));

        assertSame(g.get(7682L), g.get(9815L));
        assertSame(g.get(7653L), g.get(8886L), "Dan Patlansky ayni anda iki mekanda olamaz");
        assertSame(g.get(601L), g.get(602L));
        assertNotSame(g.get(603L), g.get(604L), "farkli sanatcilar ayri kalir");
    }

    @Test
    void sameVenueSessionsStaySeparateButTwoBranchesAtTheSameTimeAreOne() {
        // Ayni kaynak, ayni mekan (iki yazim), iki gercek saat (2 saat fark): ayri seans
        Event early = event(9437, "Kadebostany", "Volkswagen Arena Maslak", "İstanbul", "2026-10-02T20:00",
                EventSource.TICKETMASTER, null);
        Event late = event(7886, "Kadebostany", "Maslak Volkswagen Sahnesi", "İstanbul", "2026-10-02T22:00",
                EventSource.TICKETMASTER, null);

        // Ayni sanatci ayni saatte iki subede olamaz: tek konser
        Event jjA = event(501, "Mabel Matiz", "Jolly Joker Atakent", "İstanbul", "2026-10-05T21:00",
                EventSource.TICKETMASTER, null);
        Event jjB = event(502, "Mabel Matiz", "Jolly Joker Kadıköy", "İstanbul", "2026-10-05T21:00",
                EventSource.TICKETMASTER, null);
        jjA.getVenue().setLatitude(41.02);
        jjA.getVenue().setLongitude(28.66);
        jjB.getVenue().setLatitude(40.99);
        jjB.getVenue().setLongitude(29.03);

        Map<Long, ConcertGrouping.Group> g = grouping.group(List.of(early, late, jjA, jjB));

        assertNotSame(g.get(9437L), g.get(7886L), "ayni mekanda iki seans");
        assertSame(g.get(501L), g.get(502L));
    }

    @Test
    void sameArtistSameCityWithinSixHoursIsOneConcertPreferringTheKnownTime() {
        // Gercek veri: Gulsen, Oran Acikhava — Biletinial'da 21:00 ve saati bilinmeyen 00:00 kaydi
        Event known = event(9563, "Gülşen", "Oran Açık Hava Sahnesi", "Ankara", "2026-10-04T21:00",
                EventSource.BILETINIAL, null);
        Event midnight = event(10127, "Gülşen", "Oran Açık Hava Sahnesi", "Ankara", "2026-10-05T00:00",
                EventSource.BILETINIAL, null);
        Event bubilet = event(10412, "Gülşen", "Oran Açık Hava Sahnesi", "Ankara", "2026-10-04T21:00",
                EventSource.BUBILET, null);
        // Farkli kaynaklar 3 saat farkla: tek konser
        Event a = event(701, "Kadebostany", "Volkswagen Arena Maslak", "İstanbul", "2026-10-02T20:00",
                EventSource.BILETINIAL, null);
        Event b = event(702, "Kadebostany", "Maslak Volkswagen Sahnesi", "İstanbul", "2026-10-02T23:00",
                EventSource.TICKETMASTER, null);
        // 6 saatten uzak: ayri konser
        Event c = event(703, "Kadebostany", "Volkswagen Arena Maslak", "İstanbul", "2026-10-03T06:30",
                EventSource.BUBILET, null);

        Map<Long, ConcertGrouping.Group> g = grouping.group(List.of(midnight, known, bubilet, a, b, c));

        assertSame(g.get(9563L), g.get(10127L));
        assertSame(g.get(9563L), g.get(10412L));
        assertNotEquals(10127L, g.get(10127L).canonical().getId(), "saati bilinen kayit gosterilir");
        assertSame(g.get(701L), g.get(702L));
        assertNotSame(g.get(702L), g.get(703L));

        List<Event> collapsed = grouping.collapse(List.of(known, midnight));
        assertEquals(List.of(9563L), collapsed.stream().map(Event::getId).toList());
        assertTrue(grouping.toleranceMinutes() >= 360, "pencere sorgusu 6 saati kapsamali");
    }

    @Test
    void differentlyWrittenArtistAtTheSameTimeIsOneConcertShowingTheVerifiedSource() {
        // Gercek veri: Ticketmaster "Ahmet Ihvani" / Biletinial "Ahmet Aslan ve Ahmet Ihvani Konserleri"
        Event tm = event(8878, "Ahmet Ihvani", "Çankaya Belediyesi Atatürk Sanat Merkezi", "Ankara",
                "2026-10-17T20:30", EventSource.TICKETMASTER, null);
        tm.setName("Ahmet Aslan & Ahmet İhvani");
        Event bi = event(10076, "Ahmet Aslan ve Ahmet İhvani Konserleri", "ASM-Mavi Salon", "Ankara",
                "2026-10-17T20:30", EventSource.BILETINIAL, null);
        bi.setIsVerified(true);
        // Tek ortak kelime ("Ahmet") yetmez: farkli sanatci ayri kalir
        Event other = event(900, "Ahmet Kaya Anma", "Başka Salon", "Ankara", "2026-10-17T20:30",
                EventSource.BUBILET, null);
        // Ayni sanatci farkli yazim ama 2 saat fark: esnek eslesme yalnizca ayni an icin
        Event later = event(901, "Ahmet Aslan ve Ahmet İhvani Konserleri", "Başka Salon", "Ankara",
                "2026-10-17T22:30", EventSource.BUBILET, null);

        Map<Long, ConcertGrouping.Group> g = grouping.group(List.of(tm, bi, other));

        assertSame(g.get(8878L), g.get(10076L));
        assertEquals(10076L, g.get(8878L).canonical().getId(), "dogrulanmis kaynak gosterilir");
        assertNotSame(g.get(8878L), g.get(900L));

        // Esnek ad eslesmesi yalnizca ayni an icin (aradaki kayit olmadan)
        Map<Long, ConcertGrouping.Group> g2 = grouping.group(List.of(tm, later));
        assertNotSame(g2.get(8878L), g2.get(901L));
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

    @Test
    void looselyMatchingPerformerAtTheSameVenueAnHourApartIsOneCardAcrossSites() {
        // Gerçek veri (6 Eki 2026): Biletix "Mansur Ark" 22:00 / BiletimGo "Mansur Ark & Dj Fikret Kocamaz" 21:00
        Event tm = event(1, "Mansur Ark", "Hayal Kahvesi Bahçeşehir", "İstanbul", "2026-10-17T22:00",
                EventSource.TICKETMASTER, "https://www.biletix.com/x");
        Event bg = event(2, "Mansur Ark & Dj Fikret Kocamaz", "Hayal Kahvesi Bahçeşehir", "İstanbul", "2026-10-17T21:00",
                EventSource.BILETIMGO, "https://www.biletimgo.com/etkinlik/x-31097");
        assertTrue(grouping.sameConcertForListing(tm, bg));

        // Aynı sitenin aynı mekândaki iki kaydı ayrı seans olabilir: birleşmez
        Event bg2 = event(3, "Mansur Ark & Dj Fikret Kocamaz", "Hayal Kahvesi Bahçeşehir", "İstanbul", "2026-10-17T23:30",
                EventSource.BILETIMGO, "https://www.biletimgo.com/etkinlik/y-31098");
        Event bg3 = event(4, "Mansur Ark", "Hayal Kahvesi Bahçeşehir", "İstanbul", "2026-10-17T21:00",
                EventSource.BILETIMGO, "https://www.biletimgo.com/etkinlik/z-31099");
        assertFalse(grouping.sameConcertForListing(bg2, bg3));

        // Farklı mekânda ve bir saatten fazla arayla: birleşmez
        Event other = event(5, "Mansur Ark", "Jolly Joker Kartal", "İstanbul", "2026-10-17T22:30",
                EventSource.BUBILET, "https://www.bubilet.com.tr/x");
        assertFalse(grouping.sameConcertForListing(bg, other));
    }

    @Test
    void singleWordNameOverlapAtDifferentVenuesIsNotTheSameConcert() {
        // Gerçek veri (6 Eki 2026): "Yaşar" Jolly Joker / "Ebru Yaşar & Senfoni" Volkswagen Arena, aynı saat
        Event yasar = event(1, "Yaşar", "Jolly Joker Kartal", "İstanbul", "2026-10-24T21:00",
                EventSource.TICKETMASTER, "https://www.biletix.com/x");
        Event ebru = event(2, "Ebru Yaşar", "Volkswagen Arena", "İstanbul", "2026-10-24T21:00",
                EventSource.BUBILET, "https://www.bubilet.com.tr/x");
        ebru.setName("Ebru Yaşar & Senfoni");
        assertFalse(grouping.sameConcertForListing(yasar, ebru));

        // Aynı mekânda tek kelimelik eşleşme hâlâ tek kart
        Event yasarBubilet = event(3, "Yaşar Konseri", "Jolly Joker Kartal", "İstanbul", "2026-10-24T21:00",
                EventSource.BUBILET, "https://www.bubilet.com.tr/y");
        assertTrue(grouping.sameConcertForListing(yasar, yasarBubilet));
    }
}
