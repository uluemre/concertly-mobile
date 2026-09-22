package com.concertly.backend.service.ingest;

import com.concertly.backend.model.Artist;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.Venue;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Kaynaklar arasi eslestirme kurallari.
 *
 * Bu testlerin varlik sebebi tek cumleyle: iki AYRI konseri birlestirmek,
 * ayni konseri iki kere listelemekten cok daha pahali. Asagidaki senaryolar
 * kurallarin bu yonde kati kaldigini garanti eder.
 */
class EventMatcherTest {

    private final EventMatcher matcher = new EventMatcher(120, 150);

    private static Event event(long id, String artist, String venue, String city, LocalDateTime date) {
        Artist a = new Artist();
        a.setName(artist);
        Venue v = new Venue();
        v.setName(venue);
        v.setCity(city);
        Event e = new Event();
        ReflectionTestUtils.setField(e, "id", id);
        e.setArtist(a);
        e.setVenue(v);
        e.setEventDate(date);
        return e;
    }

    private static LocalDateTime at(String iso) {
        return LocalDateTime.parse(iso);
    }

    /** 1) Ayni sanatci + ayni mekan + ayni sehir + ayni tarih. */
    @Test
    void sameArtistVenueCityAndTimeMatches() {
        Event tm = event(1, "Duman", "Zorlu PSM", "İstanbul", at("2026-11-15T21:00"));
        Event bi = event(2, "Duman", "Zorlu PSM", "İstanbul", at("2026-11-15T21:00"));

        EventMatcher.MatchResult result = matcher.compare(tm, bi);
        assertTrue(result.isMatch(), result.reason());
        assertEquals(EventMatcher.Confidence.STRONG, result.confidence());
    }

    /** 2) Ayni sanatci, farkli sehir: turne duragidir, asla birlesmemeli. */
    @Test
    void sameArtistDifferentCityDoesNotMatch() {
        Event ankara = event(1, "Duman", "Oran Sahne", "Ankara", at("2026-11-15T21:00"));
        Event izmir = event(2, "Duman", "Kulturpark", "İzmir", at("2026-11-15T21:00"));

        EventMatcher.MatchResult result = matcher.compare(ankara, izmir);
        assertFalse(result.isMatch());
        assertEquals(EventMatcher.Confidence.NONE, result.confidence());
        assertTrue(result.reason().contains("Sehir farkli"), result.reason());
    }

    /** 3) Ayni sanatci + ayni sehir, farkli tarih: iki ayri konser. */
    @Test
    void sameArtistSameCityDifferentDateDoesNotMatch() {
        Event first = event(1, "Duman", "Zorlu PSM", "İstanbul", at("2026-11-15T21:00"));
        Event second = event(2, "Duman", "Zorlu PSM", "İstanbul", at("2026-11-16T21:00"));

        EventMatcher.MatchResult result = matcher.compare(first, second);
        assertFalse(result.isMatch());
        assertEquals(EventMatcher.Confidence.NONE, result.confidence());
        assertEquals(24 * 60, result.minutesApart());
    }

    /** 4) Turkce karakter ve buyuk/kucuk harf farki eslesmeyi bozmamali. */
    @Test
    void turkishCharacterAndCaseDifferencesStillMatch() {
        Event tm = event(1, "Sıla", "Harbiye Açıkhava", "İstanbul", at("2026-07-10T21:30"));
        Event bi = event(2, "SILA", "HARBIYE ACIKHAVA", "Istanbul", at("2026-07-10T21:30"));

        EventMatcher.MatchResult result = matcher.compare(tm, bi);
        assertTrue(result.isMatch(), result.reason());
    }

    /** 5) Ayni mekan ve saat ama farkli sanatci: kesinlikle ayri. */
    @Test
    void differentArtistSameVenueAndTimeDoesNotMatch() {
        Event a = event(1, "Duman", "Zorlu PSM", "İstanbul", at("2026-11-15T21:00"));
        Event b = event(2, "Mor ve Ötesi", "Zorlu PSM", "İstanbul", at("2026-11-15T21:00"));

        EventMatcher.MatchResult result = matcher.compare(a, b);
        assertFalse(result.isMatch());
        assertTrue(result.reason().contains("Sanatci farkli"), result.reason());
    }

    /** 6) Saatteki kucuk fark tolere edilmeli (kapi acilisi / sahne saati farki). */
    @Test
    void smallTimeDifferenceIsTolerated() {
        Event tm = event(1, "Duman", "Zorlu PSM", "İstanbul", at("2026-11-15T20:00"));
        Event bi = event(2, "Duman", "Zorlu PSM", "İstanbul", at("2026-11-15T21:30"));

        EventMatcher.MatchResult result = matcher.compare(tm, bi);
        assertTrue(result.isMatch(), result.reason());
        assertEquals(90, result.minutesApart());
    }

    /** Tolerans disina cikan saat farki eslesmemeli. */
    @Test
    void timeDifferenceBeyondToleranceDoesNotMatch() {
        Event tm = event(1, "Duman", "Zorlu PSM", "İstanbul", at("2026-11-15T18:00"));
        Event bi = event(2, "Duman", "Zorlu PSM", "İstanbul", at("2026-11-15T21:30"));

        assertFalse(matcher.compare(tm, bi).isMatch());
    }

    /** 7) Belirsiz kayit (eksik alan) eslesmemeli. */
    @Test
    void ambiguousRecordDoesNotMatch() {
        Event complete = event(1, "Duman", "Zorlu PSM", "İstanbul", at("2026-11-15T21:00"));
        Event noCity = event(2, "Duman", "Zorlu PSM", null, at("2026-11-15T21:00"));
        Event noArtist = event(3, null, "Zorlu PSM", "İstanbul", at("2026-11-15T21:00"));
        Event noDate = event(4, "Duman", "Zorlu PSM", "İstanbul", null);

        assertFalse(matcher.compare(complete, noCity).isMatch());
        assertFalse(matcher.compare(complete, noArtist).isMatch());
        assertFalse(matcher.compare(complete, noDate).isMatch());
    }

    /** Mekan adi tutmuyorsa otomatik birlestirmeye aday olmaz, rapora ZAYIF duser. */
    @Test
    void differentVenueNameIsOnlyWeak() {
        Event a = event(1, "Duman", "Zorlu PSM", "İstanbul", at("2026-11-15T21:00"));
        Event b = event(2, "Duman", "Volkswagen Arena", "İstanbul", at("2026-11-15T21:00"));

        EventMatcher.MatchResult result = matcher.compare(a, b);
        assertEquals(EventMatcher.Confidence.WEAK, result.confidence());
        assertFalse(result.isMatch(), "ZAYIF eslesme otomatik birlestirilmemeli");
    }

    /** Mekan adinin uzun/kisa yazimi ayni salonu gosterir. */
    @Test
    void venueNameVariantsMatch() {
        Event a = event(1, "Duman", "Zorlu PSM", "İstanbul", at("2026-11-15T21:00"));
        Event b = event(2, "Duman", "Zorlu PSM Turkcell Sahnesi", "İstanbul", at("2026-11-15T21:00"));

        assertTrue(matcher.compare(a, b).isMatch());
    }

    /** "X Konseri" ile "X" ayni sanatcidir. */
    @Test
    void artistPromoSuffixIsIgnored() {
        Event a = event(1, "Halil Sezai", "Dorock XL", "İstanbul", at("2026-10-03T21:30"));
        Event b = event(2, "Halil Sezai Konseri", "Dorock XL", "İstanbul", at("2026-10-03T21:30"));

        assertTrue(matcher.compare(a, b).isMatch());
    }

    /** Ayni kaydin kendisiyle karsilastirilmasi eslesme uretmemeli. */
    @Test
    void sameEventIsNotItsOwnDuplicate() {
        Event a = event(1, "Duman", "Zorlu PSM", "İstanbul", at("2026-11-15T21:00"));
        assertFalse(matcher.compare(a, a).isMatch());
    }

    private static Event eventWithCoords(long id, String artist, String venue, String city,
            LocalDateTime date, double lat, double lon) {
        Event e = event(id, artist, venue, city, date);
        e.getVenue().setLatitude(lat);
        e.getVenue().setLongitude(lon);
        return e;
    }

    /** Ayni salonun Turkce/Ingilizce adi: adlar tutmaz ama koordinat tutar. */
    @Test
    void differentVenueNamesWithSameCoordinatesMatch() {
        Event tr = eventWithCoords(1, "Evgeny Grinko", "İzmir Kültürpark Açık Hava Tiyatrosu",
                "İzmir", at("2026-09-29T21:00"), 38.434239, 27.150477);
        Event en = eventWithCoords(2, "Evgeny Grinko", "İzmir Kültürpark Open Air Theatre",
                "İzmir", at("2026-09-29T21:00"), 38.434301, 27.150512);

        EventMatcher.MatchResult result = matcher.compare(tr, en);
        assertTrue(result.isMatch(), result.reason());
        assertTrue(result.reason().contains("koordinatlar"), result.reason());
    }

    /** Ayni sehirde baska salon: koordinat uzaksa kesinlikle ayri konser. */
    @Test
    void differentVenueCoordinatesDoNotMatch() {
        Event a = eventWithCoords(1, "Sami Yusuf", "İstanbul Kongre Merkezi",
                "İstanbul", at("2026-09-27T21:00"), 41.046371, 28.988916);
        Event b = eventWithCoords(2, "Sami Yusuf", "Harbiye Cemil Topuzlu Açıkhava",
                "İstanbul", at("2026-09-27T21:00"), 41.048500, 28.995900);

        EventMatcher.MatchResult result = matcher.compare(a, b);
        assertEquals(EventMatcher.Confidence.NONE, result.confidence(), result.reason());
        assertTrue(result.reason().contains("uzakta"), result.reason());
    }

    /** Koordinat yoksa karar verilemez: ZAYIF kalir, otomatik birlesmez. */
    @Test
    void differentVenueWithoutCoordinatesStaysWeak() {
        Event a = event(1, "Duman", "Zorlu PSM", "İstanbul", at("2026-11-15T21:00"));
        Event b = event(2, "Duman", "Volkswagen Arena", "İstanbul", at("2026-11-15T21:00"));

        assertEquals(EventMatcher.Confidence.WEAK, matcher.compare(a, b).confidence());
    }
}
