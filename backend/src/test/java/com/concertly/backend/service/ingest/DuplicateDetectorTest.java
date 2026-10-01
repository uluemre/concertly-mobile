package com.concertly.backend.service.ingest;

import com.concertly.backend.model.Artist;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventSource;
import com.concertly.backend.model.Venue;
import com.concertly.backend.service.ingest.DuplicateDetector.ArtistCandidate;
import com.concertly.backend.service.ingest.DuplicateDetector.EventCluster;
import com.concertly.backend.service.ingest.DuplicateDetector.Group;
import com.concertly.backend.service.ingest.DuplicateDetector.VenueCandidate;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** N-08 / N-09: mukerrer sanatci, mekan ve etkinlik tespitinin saf mantigi. */
class DuplicateDetectorTest {

    private static ArtistCandidate artist(long id, String name) {
        return new ArtistCandidate(id, name, false, 0, 0, 0);
    }

    private static VenueCandidate venue(long id, String name, String city) {
        return new VenueCandidate(id, name, city, null, null, 0, false);
    }

    private static VenueCandidate venueAt(long id, String name, String city, double lat, double lon) {
        return new VenueCandidate(id, name, city, lat, lon, 0, false);
    }

    private static List<Long> dupIds(Group<?> g) {
        return g.duplicates().stream().map(m -> {
            Object d = m.duplicate();
            return d instanceof ArtistCandidate a ? a.id() : ((VenueCandidate) d).id();
        }).toList();
    }

    // ───────────── sanatci ─────────────

    @Test
    void hadiseCaseAndTurkishVariantsFormOneHighConfidenceGroup() {
        var groups = DuplicateDetector.groupArtists(List.of(
                artist(1, "Hadise"), artist(2, "HADİSE"), artist(3, "hadise"), artist(4, "Sezen Aksu")), MergeConfidence.LOW);

        assertEquals(1, groups.size());
        assertEquals(1L, groups.get(0).canonical().id());          // eşitlikte en küçük id
        assertEquals(List.of(2L, 3L), dupIds(groups.get(0)));
        assertTrue(groups.get(0).duplicates().stream().allMatch(m -> m.confidence() == MergeConfidence.HIGH));
        assertTrue(groups.get(0).duplicates().get(0).reason().startsWith("NAME_KEY"));
    }

    @Test
    void sebnemFerahSpellingsGroup() {
        var groups = DuplicateDetector.groupArtists(List.of(artist(10, "Şebnem Ferah"), artist(11, "Sebnem Ferah")),
                MergeConfidence.LOW);
        assertEquals(1, groups.size());
        assertEquals(List.of(11L), dupIds(groups.get(0)));
    }

    @Test
    void leadingTheAndAmpersandVariantsAreMediumConfidence() {
        var groups = DuplicateDetector.groupArtists(List.of(
                artist(1, "The Weeknd"), artist(2, "Weeknd"),
                artist(3, "Mor ve Ötesi"), artist(4, "Mor & Ötesi"), artist(5, "Mor and Ötesi")), MergeConfidence.LOW);
        assertEquals(2, groups.size());
        for (var g : groups) {
            assertTrue(g.duplicates().stream().allMatch(m -> m.confidence() == MergeConfidence.MEDIUM), g.toString());
            assertTrue(g.duplicates().get(0).reason().startsWith("WIDE_NAME"));
        }
    }

    @Test
    void minConfidenceHighDropsWideNameMatches() {
        var all = List.of(artist(1, "The Weeknd"), artist(2, "Weeknd"), artist(3, "Hadise"), artist(4, "HADISE"));
        var groups = DuplicateDetector.groupArtists(all, MergeConfidence.HIGH);
        assertEquals(1, groups.size());
        assertEquals(3L, groups.get(0).canonical().id());
    }

    @Test
    void differentArtistsSharingAWordAreNotGrouped() {
        assertTrue(DuplicateDetector.groupArtists(List.of(artist(1, "Sıla"), artist(2, "Sıla Gençoğlu"),
                artist(3, "Mor"), artist(4, "Mor ve Ötesi")), MergeConfidence.LOW).isEmpty());
        assertTrue(DuplicateDetector.groupArtists(List.of(artist(1, "***"), artist(2, "!!!")), MergeConfidence.LOW).isEmpty());
    }

    @Test
    void canonicalArtistRankingIsSpotifyThenUpcomingThenFollowersThenTotalThenId() {
        // Spotify kimliği olan kazanır (etkinliği az olsa bile)
        var spotify = new ArtistCandidate(9L, "Hadise", true, 0, 0, 0);
        var busy = new ArtistCandidate(1L, "HADISE", false, 50, 50, 50);
        assertEquals(9L, DuplicateDetector.groupArtists(List.of(busy, spotify), MergeConfidence.LOW).get(0).canonical().id());

        // Spotify eşit: yaklaşan etkinlik > takipçi > toplam etkinlik > küçük id
        assertEquals(5L, canonicalOf(new ArtistCandidate(4L, "Sila", false, 1, 99, 99),
                new ArtistCandidate(5L, "SILA", false, 2, 0, 0)));
        assertEquals(5L, canonicalOf(new ArtistCandidate(4L, "Sila", false, 1, 3, 99),
                new ArtistCandidate(5L, "SILA", false, 1, 4, 0)));
        assertEquals(5L, canonicalOf(new ArtistCandidate(4L, "Sila", false, 1, 3, 1),
                new ArtistCandidate(5L, "SILA", false, 1, 3, 2)));
        assertEquals(4L, canonicalOf(new ArtistCandidate(5L, "Sila", false, 1, 3, 2),
                new ArtistCandidate(4L, "SILA", false, 1, 3, 2)));
    }

    private static long canonicalOf(ArtistCandidate a, ArtistCandidate b) {
        return DuplicateDetector.groupArtists(List.of(a, b), MergeConfidence.LOW).get(0).canonical().id();
    }

    // ───────────── mekan ─────────────

    @Test
    void openAirAndAcikhavaTiyatrosuInSameCityGroupAsHigh() {
        var groups = DuplicateDetector.groupVenues(List.of(
                venue(1, "Antalya Open Air", "Antalya"),
                venue(2, "Antalya Açıkhava Tiyatrosu", "Antalya")), MergeConfidence.LOW);
        assertEquals(1, groups.size());
        assertEquals(MergeConfidence.HIGH, groups.get(0).duplicates().get(0).confidence());
        assertTrue(groups.get(0).duplicates().get(0).reason().startsWith("SAME_VENUE_NAME"));
    }

    @Test
    void sameNameInDifferentCitiesNeverGroups() {
        assertTrue(DuplicateDetector.groupVenues(List.of(
                venue(1, "Açıkhava Tiyatrosu", "Ankara"),
                venue(2, "Açıkhava Tiyatrosu", "İzmir")), MergeConfidence.LOW).isEmpty());
        // Koordinat çakışsa da farklı şehir eşleşmez
        assertTrue(DuplicateDetector.groupVenues(List.of(
                venueAt(1, "Zorlu PSM", "İstanbul", 41.06, 29.01),
                venueAt(2, "Zorlu PSM", "Ankara", 41.06, 29.01)), MergeConfidence.LOW).isEmpty());
        // Boş şehir: eşleşme yok
        assertTrue(DuplicateDetector.groupVenues(List.of(venue(1, "Zorlu PSM", ""), venue(2, "Zorlu PSM", "")),
                MergeConfidence.LOW).isEmpty());
    }

    @Test
    void exactFoldedNameIsHigh() {
        var groups = DuplicateDetector.groupVenues(List.of(
                venue(1, "Zorlu PSM", "İstanbul"), venue(2, "ZORLU  PSM", "Istanbul")), MergeConfidence.LOW);
        assertEquals(1, groups.size());
        assertEquals(MergeConfidence.HIGH, groups.get(0).duplicates().get(0).confidence());
        assertTrue(groups.get(0).duplicates().get(0).reason().startsWith("EXACT_NAME"));
    }

    @Test
    void containmentHallsAreMediumWithReason() {
        var groups = DuplicateDetector.groupVenues(List.of(
                venue(1, "Zorlu PSM", "İstanbul"),
                venue(2, "Zorlu PSM Turkcell Sahnesi", "İstanbul")), MergeConfidence.LOW);
        assertEquals(1, groups.size());
        var m = groups.get(0).duplicates().get(0);
        assertEquals(MergeConfidence.MEDIUM, m.confidence());
        assertTrue(m.reason().startsWith("NAME_CONTAINS"), m.reason());
        // minConfidence HIGH bunu uygulamaz
        assertTrue(DuplicateDetector.groupVenues(List.of(
                venue(1, "Zorlu PSM", "İstanbul"),
                venue(2, "Zorlu PSM Turkcell Sahnesi", "İstanbul")), MergeConfidence.HIGH).isEmpty());
    }

    @Test
    void genericOnlyContainmentAndDifferentBranchesDoNotGroup() {
        // "Arena" tek başına ayırt edici değil
        assertTrue(DuplicateDetector.groupVenues(List.of(
                venue(1, "Arena", "İstanbul"), venue(2, "Ülker Sports Arena", "İstanbul")), MergeConfidence.LOW).isEmpty());
        // Aynı zincirin farklı şubeleri
        assertTrue(DuplicateDetector.groupVenues(List.of(
                venue(1, "Jolly Joker Kadıköy", "İstanbul"), venue(2, "Jolly Joker Beşiktaş", "İstanbul")),
                MergeConfidence.LOW).isEmpty());
    }

    @Test
    void nearbyVenuesWithSharedWordAreLowAndRequireBothCoordinates() {
        // ~110 m, ortak kelime "alpha"
        var near = DuplicateDetector.groupVenues(List.of(
                venueAt(1, "Alpha Hall", "Bursa", 40.1000, 29.0000),
                venueAt(2, "Alpha Club", "Bursa", 40.1010, 29.0000)), MergeConfidence.LOW);
        assertEquals(1, near.size());
        assertEquals(MergeConfidence.LOW, near.get(0).duplicates().get(0).confidence());
        assertTrue(near.get(0).duplicates().get(0).reason().startsWith("NEAR_AND_SHARED_WORD"));

        // > 300 m
        assertTrue(DuplicateDetector.groupVenues(List.of(
                venueAt(1, "Alpha Hall", "Bursa", 40.1000, 29.0000),
                venueAt(2, "Alpha Club", "Bursa", 40.1100, 29.0000)), MergeConfidence.LOW).isEmpty());
        // koordinat yok
        assertTrue(DuplicateDetector.groupVenues(List.of(
                venue(1, "Alpha Hall", "Bursa"), venue(2, "Alpha Club", "Bursa")), MergeConfidence.LOW).isEmpty());
        // yakın ama ortak ayırt edici kelime yok
        assertTrue(DuplicateDetector.groupVenues(List.of(
                venueAt(1, "Alpha Hall", "Bursa", 40.1000, 29.0000),
                venueAt(2, "Beta Club", "Bursa", 40.1005, 29.0000)), MergeConfidence.LOW).isEmpty());
        // minConfidence MEDIUM LOW'u uygulamaz
        assertTrue(DuplicateDetector.groupVenues(List.of(
                venueAt(1, "Alpha Hall", "Bursa", 40.1000, 29.0000),
                venueAt(2, "Alpha Club", "Bursa", 40.1010, 29.0000)), MergeConfidence.MEDIUM).isEmpty());
    }

    @Test
    void canonicalVenueRankingIsEventsThenExternalIdThenCoordinatesThenId() {
        // etkinliği çok olan kazanır (koordinat tek başına kazandırmaz)
        assertEquals(1L, venueCanonical(
                new VenueCandidate(1L, "Zorlu PSM", "İstanbul", null, null, 5, false),
                new VenueCandidate(2L, "Zorlu PSM", "İstanbul", 41.0, 29.0, 0, true)));
        // etkinlik eşit: kaynak kimliği olan
        assertEquals(2L, venueCanonical(
                new VenueCandidate(1L, "Zorlu PSM", "İstanbul", 41.0, 29.0, 5, false),
                new VenueCandidate(2L, "Zorlu PSM", "İstanbul", null, null, 5, true)));
        // etkinlik + kaynak kimliği eşit: koordinatı olan
        assertEquals(2L, venueCanonical(
                new VenueCandidate(1L, "Zorlu PSM", "İstanbul", null, null, 5, true),
                new VenueCandidate(2L, "Zorlu PSM", "İstanbul", 41.0, 29.0, 5, true)));
        // hepsi eşit: en küçük id
        assertEquals(1L, venueCanonical(
                new VenueCandidate(2L, "Zorlu PSM", "İstanbul", null, null, 5, true),
                new VenueCandidate(1L, "Zorlu PSM", "İstanbul", null, null, 5, true)));
    }

    private static long venueCanonical(VenueCandidate a, VenueCandidate b) {
        return DuplicateDetector.groupVenues(List.of(a, b), MergeConfidence.LOW).get(0).canonical().id();
    }

    @Test
    void venueGroupsAreStarsNotChains() {
        // A "Zorlu PSM" ~ B "Zorlu PSM Turkcell Sahnesi" ~ C "Zorlu PSM Turkcell Studio": B ve C ayrı salonlar.
        // Yıldız biçimi: A her ikisine de bağlanır ama B-C birbirine bağlanarak zincir kurmaz.
        var groups = DuplicateDetector.groupVenues(List.of(
                venueAt(1, "Zorlu PSM", "İstanbul", 41.0, 29.0),
                venue(2, "Zorlu PSM Turkcell Sahnesi", "İstanbul"),
                venue(3, "Zorlu PSM Studio", "İstanbul")), MergeConfidence.LOW);
        assertEquals(1, groups.size());
        assertEquals(1L, groups.get(0).canonical().id());
        assertEquals(List.of(2L, 3L), dupIds(groups.get(0)));
    }

    // ───────────── mekan: yanlis birlestirme regresyonlari (HIGH OLMAMALI) ─────────────

    private static void assertNotHigh(String nameA, String cityA, String nameB, String cityB) {
        var groups = DuplicateDetector.groupVenues(List.of(venue(1, nameA, cityA), venue(2, nameB, cityB)), MergeConfidence.HIGH);
        assertTrue(groups.isEmpty(), nameA + " == " + nameB + " HIGH olmamali");
        // Ayni koordinatla bile (ayni kompleksin farkli salonlari) HIGH olmaz
        var near = DuplicateDetector.groupVenues(List.of(venueAt(1, nameA, cityA, 41.0, 29.0), venueAt(2, nameB, cityB, 41.0, 29.0)),
                MergeConfidence.HIGH);
        assertTrue(near.isEmpty(), nameA + " == " + nameB + " (ayni koordinat) HIGH olmamali");
    }

    @Test
    void differentHallsAndVenuesFromQaListAreNeverHigh() {
        assertNotHigh("Lütfi Kırdar Anadolu Auditorium", "İstanbul", "Torium Sahne", "İstanbul");
        assertNotHigh("Holly Stone Alanya", "Antalya", "Holly Stone Antalya", "Antalya");
        assertNotHigh("AKM Tiyatro Salonu", "İstanbul", "AKM Opera Salonu", "İstanbul");
        assertNotHigh("İstanbul Kongre Merkezi Harbiye Oditoryumu", "İstanbul", "Cemil Topuzlu Açıkhava", "İstanbul");
        assertNotHigh("Ada Bar", "İstanbul", "Muaf Kadıköy", "İstanbul");
        assertNotHigh("Out Pub", "İstanbul", "Muaf Kadıköy", "İstanbul");
        assertNotHigh("All Saints Kilisesi", "İstanbul", "Moda Kayıkhane", "İstanbul");
        assertNotHigh("Sponge Pub", "İstanbul", "The Sponge Performance Hall", "İstanbul");
        assertNotHigh("Maximum Uniq Open Air", "İstanbul", "Maximum UNIQ Hall", "İstanbul");
        assertNotHigh("Küçük Salon", "Tekirdağ", "Tekirdağ Kültür Merkezi", "Tekirdağ");
        assertNotHigh("Büyük Salon", "Tekirdağ", "Tekirdağ Kültür Merkezi", "Tekirdağ");
        assertNotHigh("Küçük Salon", "Tekirdağ", "Büyük Salon", "Tekirdağ");
        assertNotHigh("Turkcell Sahnesi", "İstanbul", "Zorlu Platinum", "İstanbul");
        assertNotHigh("%100 Studio", "İstanbul", "Zorlu Platinum", "İstanbul");
        assertNotHigh("Turkcell Platinum Sahnesi", "İstanbul", "Zorlu Platinum", "İstanbul");
        // ayirt edici salon kelimeleri HIGH yolunda dusurulmez
        assertNotHigh("Zorlu PSM", "İstanbul", "Zorlu PSM Turkcell Sahnesi", "İstanbul");
        assertNotHigh("Zorlu PSM Sahne 1", "İstanbul", "Zorlu PSM Sahne 2", "İstanbul");
        assertNotHigh("Congresium Salon A", "Ankara", "Congresium Salon B", "Ankara");
        assertNotHigh("X Teras", "İstanbul", "X Studio", "İstanbul");
        assertNotHigh("X Hall", "İstanbul", "X Stage Hall", "İstanbul");
    }

    @Test
    void wrongPairsStillSurfaceAsLowerConfidenceSuggestionsOnly() {
        var groups = DuplicateDetector.groupVenues(List.of(
                venue(1, "Zorlu PSM", "İstanbul"), venue(2, "Zorlu PSM Turkcell Sahnesi", "İstanbul")), MergeConfidence.LOW);
        assertEquals(MergeConfidence.MEDIUM, groups.get(0).duplicates().get(0).confidence());
    }

    @Test
    void trueVenueVariantsStayHigh() {
        assertHigh("Zorlu PSM", "İstanbul", "ZORLU  PSM!", "Istanbul");          // noktalama
        assertHigh("Şişli Açıkhava", "İstanbul", "SISLI ACIKHAVA", "İstanbul");   // Türkçe harf / büyük-küçük
        assertHigh("Bostancı Gösteri Merkezi", "İstanbul", "bostanci gosteri merkezi!", "İstanbul");
        assertHigh("Maximum Uniq Açıkhava", "İstanbul", "Maximum Uniq Open Air", "İstanbul");
        assertHigh("Maximum Uniq Acik Hava", "İstanbul", "Maximum Uniq Open Air", "İstanbul");
        assertHigh("Antalya Open Air", "Antalya", "Antalya Açıkhava Tiyatrosu", "Antalya");
        assertHigh("Küçük Salon", "Tekirdağ", "Küçük Salonu", "Tekirdağ");
        assertHigh("Torium Sahne", "İstanbul", "Torium Sahnesi", "İstanbul");
        assertHigh("Zorlu PSM", "İstanbul", "Zorlu PSM İstanbul", "İstanbul");   // yalnizca sehir adi farki
    }

    private static void assertHigh(String nameA, String cityA, String nameB, String cityB) {
        var groups = DuplicateDetector.groupVenues(List.of(venue(1, nameA, cityA), venue(2, nameB, cityB)), MergeConfidence.HIGH);
        assertEquals(1, groups.size(), nameA + " ~ " + nameB + " HIGH olmali");
        assertEquals(MergeConfidence.HIGH, groups.get(0).duplicates().get(0).confidence());
    }

    @Test
    void differentCityNeverHighEvenWithIdenticalName() {
        assertNotHigh("Zorlu PSM", "İstanbul", "Zorlu PSM", "Ankara");
    }

    // ───────────── etkinlik ─────────────

    private static Event event(long id, long artistId, long venueId, LocalDateTime date, EventSource source) {
        Event e = new Event();
        ReflectionTestUtils.setField(e, "id", id);
        Artist a = new Artist();
        ReflectionTestUtils.setField(a, "id", artistId);
        Venue v = new Venue();
        ReflectionTestUtils.setField(v, "id", venueId);
        e.setArtist(a);
        e.setVenue(v);
        e.setEventDate(date);
        e.setSource(source);
        e.setName("E" + id);
        return e;
    }

    private static List<EventCluster> cluster(List<Event> events, Map<Long, Long> artistMap, Map<Long, Long> venueMap,
                                              MergeConfidence min) {
        EventMergeService chooser = new EventMergeService(null, null);
        return DuplicateDetector.clusterEvents(events, id -> artistMap.getOrDefault(id, id),
                id -> venueMap.getOrDefault(id, id), new HashMap<>(), new HashMap<>(), min, chooser::chooseCanonical);
    }

    @Test
    void bestArtistNamePrefersProperCaseThenTurkishLetters() {
        assertEquals("Şebnem Ferah", DuplicateDetector.bestArtistName(List.of("Sebnem Ferah", "Şebnem Ferah")));
        assertEquals("Fazıl Say", DuplicateDetector.bestArtistName(List.of("Fazil Say", "Fazıl Say")));
        assertEquals("Mor ve Ötesi", DuplicateDetector.bestArtistName(List.of("mor ve ötesi", "Mor ve Ötesi")));
        assertEquals("Hadise", DuplicateDetector.bestArtistName(List.of("Hadise", "HADİSE", "hadise")));
        assertEquals("Hadise", DuplicateDetector.bestArtistName(List.of("Hadise", "Hadise")));
    }

    @Test
    void ticketProductMarkerDowngradesEventPairToMedium() {
        Event a = event(1, 1, 1, D, EventSource.ADMIN);
        Event b = event(2, 1, 1, D, EventSource.ADMIN);
        a.setName("Milyonfest Didim 2026 - Perşembe");
        b.setName("Milyonfest Didim 2026 - VIP Günlük Bilet - Dilediğin Bir Gün");
        assertTrue(cluster(List.of(a, b), Map.of(), Map.of(), MergeConfidence.HIGH).isEmpty());
        assertEquals(MergeConfidence.MEDIUM,
                cluster(List.of(a, b), Map.of(), Map.of(), MergeConfidence.MEDIUM).get(0).duplicates().get(0).confidence());
        b.setName(a.getName());
        assertEquals(1, cluster(List.of(a, b), Map.of(), Map.of(), MergeConfidence.HIGH).size());
        assertTrue(DuplicateDetector.ticketProductTitlesDiffer("X Konseri", "X Konseri Meet & Greet"));
        assertTrue(DuplicateDetector.ticketProductTitlesDiffer("X", "X Her Gün Giriş"));
        assertFalse(DuplicateDetector.ticketProductTitlesDiffer("X Konseri", "X - Konseri"));
        assertFalse(DuplicateDetector.ticketProductTitlesDiffer("X Konseri", "X Konseri 2026"));
    }

    private static final LocalDateTime D =LocalDateTime.of(2026, 11, 20, 20, 0);

    @Test
    void sameDayDifferentTimesAreSeparateShows() {
        var clusters = cluster(List.of(
                event(1, 7, 8, D, EventSource.ADMIN),
                event(2, 7, 8, D.plusHours(3), EventSource.ADMIN)), Map.of(), Map.of(), MergeConfidence.LOW);
        assertTrue(clusters.isEmpty());
    }

    @Test
    void thirtyMinutesApartMergesAndTenMinutesIsHigh() {
        var thirty = cluster(List.of(
                event(1, 7, 8, D, EventSource.ADMIN),
                event(2, 7, 8, D.plusMinutes(30), EventSource.ADMIN)), Map.of(), Map.of(), MergeConfidence.LOW);
        assertEquals(1, thirty.size());
        assertEquals(1L, thirty.get(0).canonical().getId());
        assertEquals(MergeConfidence.MEDIUM, thirty.get(0).duplicates().get(0).confidence());
        assertEquals(30, thirty.get(0).duplicates().get(0).minutesApart());

        var ten = cluster(List.of(
                event(1, 7, 8, D, EventSource.ADMIN),
                event(2, 7, 8, D.plusMinutes(10), EventSource.ADMIN)), Map.of(), Map.of(), MergeConfidence.LOW);
        assertEquals(MergeConfidence.HIGH, ten.get(0).duplicates().get(0).confidence());

        // 61 dk: birleşmez; minConfidence HIGH 30 dk'yı uygulamaz
        assertTrue(cluster(List.of(event(1, 7, 8, D, EventSource.ADMIN),
                event(2, 7, 8, D.plusMinutes(61), EventSource.ADMIN)), Map.of(), Map.of(), MergeConfidence.LOW).isEmpty());
        assertTrue(cluster(List.of(event(1, 7, 8, D, EventSource.ADMIN),
                event(2, 7, 8, D.plusMinutes(30), EventSource.ADMIN)), Map.of(), Map.of(), MergeConfidence.HIGH).isEmpty());
    }

    @Test
    void ticketmasterBecomesCanonicalAndAnchorCanBeTheDuplicate() {
        var clusters = cluster(List.of(
                event(1, 7, 8, D, EventSource.BILETINIAL),
                event(2, 7, 8, D.plusMinutes(5), EventSource.TICKETMASTER)), Map.of(), Map.of(), MergeConfidence.LOW);
        assertEquals(2L, clusters.get(0).canonical().getId());
        assertEquals(List.of(1L), clusters.get(0).duplicates().stream().map(m -> m.duplicate().getId()).toList());
    }

    @Test
    void clustersAreAnchoredSoChainsDoNotStretch() {
        // 20:00, 20:50, 21:40: 21:40 ilk kayıttan 100 dk uzak, zincirle birleşmez
        var clusters = cluster(List.of(
                event(1, 7, 8, D, EventSource.ADMIN),
                event(2, 7, 8, D.plusMinutes(50), EventSource.ADMIN),
                event(3, 7, 8, D.plusMinutes(100), EventSource.ADMIN)), Map.of(), Map.of(), MergeConfidence.LOW);
        assertEquals(1, clusters.size());
        assertEquals(List.of(2L), clusters.get(0).duplicates().stream().map(m -> m.duplicate().getId()).toList());
    }

    @Test
    void artistAndVenueDuplicatesAreMappedToCanonicalBeforePairing() {
        // 7 ve 70 aynı sanatçı, 8 ve 80 aynı mekan olarak eşlenmiş
        var clusters = cluster(List.of(
                event(1, 7, 8, D, EventSource.ADMIN),
                event(2, 70, 80, D.plusMinutes(20), EventSource.ADMIN)), Map.of(70L, 7L), Map.of(80L, 8L), MergeConfidence.LOW);
        assertEquals(1, clusters.size());
        // Eşleme yoksa aynı iki etkinlik birleşmez
        assertTrue(cluster(List.of(
                event(1, 7, 8, D, EventSource.ADMIN),
                event(2, 70, 80, D.plusMinutes(20), EventSource.ADMIN)), Map.of(), Map.of(), MergeConfidence.LOW).isEmpty());
        // Farklı sanatçı aynı mekan/saat: birleşmez
        assertTrue(cluster(List.of(
                event(1, 7, 8, D, EventSource.ADMIN),
                event(2, 9, 8, D, EventSource.ADMIN)), Map.of(), Map.of(), MergeConfidence.LOW).isEmpty());
    }

    @Test
    void eventConfidenceIsCappedByTheArtistAndVenueMatchConfidence() {
        EventMergeService chooser = new EventMergeService(null, null);
        var low = DuplicateDetector.clusterEvents(List.of(
                        event(1, 7, 8, D, EventSource.ADMIN), event(2, 70, 80, D, EventSource.ADMIN)),
                id -> id == 70 ? 7L : id, id -> id == 80 ? 8L : id,
                Map.of(70L, MergeConfidence.MEDIUM), Map.of(80L, MergeConfidence.LOW), MergeConfidence.LOW,
                chooser::chooseCanonical);
        assertEquals(MergeConfidence.LOW, low.get(0).duplicates().get(0).confidence());
        assertTrue(DuplicateDetector.clusterEvents(List.of(
                        event(1, 7, 8, D, EventSource.ADMIN), event(2, 70, 80, D, EventSource.ADMIN)),
                id -> id == 70 ? 7L : id, id -> id == 80 ? 8L : id,
                Map.of(70L, MergeConfidence.MEDIUM), Map.of(80L, MergeConfidence.LOW), MergeConfidence.MEDIUM,
                chooser::chooseCanonical).isEmpty());
    }
}
