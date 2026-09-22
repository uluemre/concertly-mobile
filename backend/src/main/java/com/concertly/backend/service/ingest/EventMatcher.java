package com.concertly.backend.service.ingest;

import com.concertly.backend.model.Event;
import com.concertly.backend.model.Venue;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Set;

/**
 * Iki kaynaktan gelen kayitlarin AYNI konser olup olmadigina karar verir.
 *
 * Tasarim ilkesi: yanlis pozitif, kacirilan eslesmeden pahalidir. Iki ayri
 * konser birlestirilirse kullanicinin katilimi, sohbeti ve konum dogrulamasi
 * yanlis etkinlige baglanir; kacirilan eslesme ise yalnizca listede iki satir
 * demektir. Bu yuzden kurallar bilerek katidir ve emin olunmayan her durum
 * ZAYIF olarak isaretlenip otomatik birlestirmenin disinda birakilir.
 *
 * Yapay zeka/ML yok: kurallar aciklanabilir ve tek tek test edilebilir.
 */
@Component
public class EventMatcher {

    /** Eslesme gucu. Yalnizca STRONG otomatik birlestirmeye aday olabilir. */
    public enum Confidence { STRONG, WEAK, NONE }

    /**
     * @param confidence karar
     * @param reason insan tarafindan okunabilir gerekce (rapor ve hata ayiklama icin)
     * @param minutesApart iki etkinlik saati arasindaki fark
     */
    public record MatchResult(Confidence confidence, String reason, long minutesApart) {
        public boolean isStrong() { return confidence == Confidence.STRONG; }
        public boolean isMatch()  { return confidence == Confidence.STRONG; }
    }

    private static final MatchResult NONE_MISSING_DATA =
            new MatchResult(Confidence.NONE, "Karsilastirma icin alan eksik", -1);

    /** Sanatci adinin sonundaki tanitim ekleri; "Duman Konseri" ile "Duman" ayni sanatcidir. */
    private static final Set<String> ARTIST_SUFFIXES = Set.of("konseri", "konser");

    private final long toleranceMinutes;
    private final double venueDistanceMeters;

    public EventMatcher(
            @Value("${app.matching.time-tolerance-minutes:120}") long toleranceMinutes,
            @Value("${app.matching.venue-distance-meters:75}") double venueDistanceMeters) {
        this.toleranceMinutes = toleranceMinutes;
        this.venueDistanceMeters = venueDistanceMeters;
    }

    /**
     * Iki etkinligi karsilastirir.
     *
     * Sira onemli: once kesin RET kurallari (sehir, tarih, sanatci), sonra
     * mekana gore guc belirleme.
     */
    public MatchResult compare(Event a, Event b) {
        if (a == null || b == null || a.getId() != null && a.getId().equals(b.getId())) {
            return new MatchResult(Confidence.NONE, "Ayni kayit", -1);
        }

        LocalDateTime dateA = a.getEventDate();
        LocalDateTime dateB = b.getEventDate();
        String artistA = artistKey(a);
        String artistB = artistKey(b);
        String cityA = normalize(cityOf(a));
        String cityB = normalize(cityOf(b));

        // Belirsiz kayit eslesmez: eksik alanla karar verilmez.
        if (dateA == null || dateB == null
                || artistA.isEmpty() || artistB.isEmpty()
                || cityA.isEmpty() || cityB.isEmpty()) {
            return NONE_MISSING_DATA;
        }

        // 1) Sehir farkliysa asla ayni konser degildir.
        if (!cityA.equals(cityB)) {
            return new MatchResult(Confidence.NONE, "Sehir farkli: " + cityA + " / " + cityB, -1);
        }

        // 2) Saat farki toleransin disindaysa ayri konserdir.
        //    Fark dakika cinsinden olculur; boylece gece yarisini asan seanslar
        //    (23:30 / 00:30) dogru sekilde ayni sayilirken ertesi gun ayni saat
        //    (24 saat fark) elenir.
        long minutesApart = Math.abs(Duration.between(dateA, dateB).toMinutes());
        if (minutesApart > toleranceMinutes) {
            return new MatchResult(Confidence.NONE,
                    "Tarih/saat farki " + minutesApart + " dk (tolerans " + toleranceMinutes + ")", minutesApart);
        }

        // 3) Sanatci ayni olmali.
        if (!artistA.equals(artistB)) {
            return new MatchResult(Confidence.NONE,
                    "Sanatci farkli: " + artistA + " / " + artistB, minutesApart);
        }

        // 4) Mekan: ayni ya da biri digerini kapsiyorsa guclu eslesme.
        String venueA = normalize(venueNameOf(a));
        String venueB = normalize(venueNameOf(b));
        if (venueA.isEmpty() || venueB.isEmpty()) {
            return new MatchResult(Confidence.WEAK,
                    "Mekan adi eksik, sanatci+sehir+saat tutuyor", minutesApart);
        }
        if (venueMatches(venueA, venueB)) {
            return new MatchResult(Confidence.STRONG,
                    "Sanatci + mekan + sehir + saat tutuyor (" + minutesApart + " dk fark)", minutesApart);
        }

        // Mekan ADLARI tutmuyor ama KOORDINATLARI cakisiyor olabilir. Ayni salon
        // kaynaklara gore "Izmir Kulturpark Acik Hava Tiyatrosu" ve "Izmir
        // Kulturpark Open Air Theatre" diye gecebiliyor; ad karsilastirmasi bunu
        // yakalayamaz, koordinat yakalar.
        Double distance = venueDistance(a, b);
        if (distance != null && distance <= venueDistanceMeters) {
            return new MatchResult(Confidence.STRONG,
                    "Sanatci + sehir + saat tutuyor, mekan adlari farkli ama koordinatlar "
                            + Math.round(distance) + " m yakin", minutesApart);
        }
        if (distance != null && distance > venueDistanceMeters) {
            // Koordinatlar acikca farkli: ayni sehirde baska bir salon.
            return new MatchResult(Confidence.NONE,
                    "Mekanlar " + Math.round(distance) + " m uzakta, ayri salon", minutesApart);
        }

        // Mekan adlari tutmuyor: ayni salonun farkli yazimi da olabilir, sehirdeki
        // baska bir salonda ayni saatte baska bir konser de. Emin olmadan
        // birlestirmeyiz; rapora ZAYIF olarak duser.
        return new MatchResult(Confidence.WEAK,
                "Mekan adlari farkli: " + venueA + " / " + venueB, minutesApart);
    }

    /**
     * Iki etkinligin mekanlari arasindaki mesafe (metre); koordinat eksikse null.
     * Haversine hesabi konum dogrulamasindaki metotla ayni.
     */
    private static Double venueDistance(Event a, Event b) {
        Venue va = a.getVenue();
        Venue vb = b.getVenue();
        if (va == null || vb == null) return null;
        if (va.getLatitude() == null || va.getLongitude() == null) return null;
        if (vb.getLatitude() == null || vb.getLongitude() == null) return null;
        return com.concertly.backend.service.EventVerificationService.distanceInMeters(
                va.getLatitude(), va.getLongitude(), vb.getLatitude(), vb.getLongitude());
    }

    /** Mekan adlari ayni mi; kapsama yazim farklarini tolere eder. */
    static boolean venueMatches(String venueA, String venueB) {
        if (venueA.equals(venueB)) return true;
        String shorter = venueA.length() <= venueB.length() ? venueA : venueB;
        String longer = shorter.equals(venueA) ? venueB : venueA;
        // Cok kisa parcalarin kapsamasi tesadufi olabilir.
        return shorter.length() >= 5 && longer.contains(shorter);
    }

    /** Sanatci adini karsilastirmaya hazirlar: normalize eder, tanitim ekini atar. */
    static String artistKey(Event event) {
        String name = event.getArtist() != null ? event.getArtist().getName() : null;
        String normalized = normalize(name);
        if (normalized.isEmpty()) return "";
        String[] tokens = normalized.split(" ");
        int end = tokens.length;
        while (end > 1 && ARTIST_SUFFIXES.contains(tokens[end - 1])) end--;
        return String.join(" ", java.util.Arrays.copyOfRange(tokens, 0, end));
    }

    /**
     * Turkce karakterleri katlar, noktalamayi bosluga cevirir, fazla boslugu atar.
     * "İSTANBUL", "Istanbul" ve "istanbul" ayni anahtara duser.
     */
    static String normalize(String value) {
        if (value == null) return "";
        String folded = value
                .replace('İ', 'I').replace('ı', 'i')
                .replace('Ş', 'S').replace('ş', 's')
                .replace('Ğ', 'G').replace('ğ', 'g')
                .replace('Ü', 'U').replace('ü', 'u')
                .replace('Ö', 'O').replace('ö', 'o')
                .replace('Ç', 'C').replace('ç', 'c')
                .replace('Â', 'A').replace('â', 'a')
                .toLowerCase(Locale.ROOT);
        return folded.replaceAll("[^a-z0-9]", " ").replaceAll("\s+", " ").trim();
    }

    private static String cityOf(Event event) {
        Venue venue = event.getVenue();
        return venue != null ? venue.getCity() : null;
    }

    private static String venueNameOf(Event event) {
        Venue venue = event.getVenue();
        return venue != null ? venue.getName() : null;
    }

    public long getToleranceMinutes() {
        return toleranceMinutes;
    }
}
