package com.concertly.backend.service.ingest;

import com.concertly.backend.model.Event;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Konser listesinde ayni konserin kopyalarini TEK kart altinda toplar.
 *
 * Neden: birlestirme (EventMergeService) bilerek yalnizca admin onayiyla
 * yapiliyor; onaylanmayi bekleyen kopyalar listede iki-uc kez gorunuyordu
 * (Ticketmaster + Biletinial ya da Ticketmaster'in ayni konser icin actigi
 * ikinci kimlik). Bu sinif VERIYE DOKUNMAZ; yalnizca cevabi birlestirir.
 *
 * Karar merge altyapisiyla ayni kurallarla verilir:
 *  - eslesme: EventMatcher STRONG; ayrica dar bir gosterim kurali (bkz. sameConcertForListing)
 *  - asil kayit: EventMergeService.chooseCanonical (Ticketmaster once, sonra kucuk id)
 * Boylece admin bir cifti sonradan birlestirdiginde listede gorunen kart degismez.
 */
@Component
public class ConcertGrouping {

    private final EventMatcher matcher;
    private final EventMergeService mergeService;

    public ConcertGrouping(EventMatcher matcher, EventMergeService mergeService) {
        this.matcher = matcher;
        this.mergeService = mergeService;
    }

    /** Bir kopya grubu: listede gosterilecek kayit ve tum uyeler. */
    public record Group(Event canonical, List<Event> members) {}

    /** Kopyalarin saat farki bu kadar olabilir; pencere sorgusu icin. */
    public long toleranceMinutes() {
        return matcher.getToleranceMinutes();
    }

    /**
     * Aday kumesini gruplara ayirir. Esleme gecisli kabul edilir (A~B, B~C ise
     * uc kayit tek grup); aksi halde bir kaydin asil kaydi baska bir grupta
     * kaybolabilirdi.
     *
     * @return her kaydin id'sinden grubuna
     */
    public Map<Long, Group> group(Collection<Event> candidates) {
        List<Event> events = candidates.stream()
                .filter(e -> e != null && e.getId() != null)
                .sorted(Comparator.comparing(Event::getId))
                .toList();
        Map<Long, Long> parent = new HashMap<>();
        for (Event e : events) parent.put(e.getId(), e.getId());

        // Sehir farkliysa eslesme zaten yok; karsilastirmayi sehir icinde yap.
        Map<String, List<Event>> byCity = new LinkedHashMap<>();
        for (Event e : events) {
            String city = e.getVenue() == null ? "" : EventMatcher.normalize(e.getVenue().getCity());
            byCity.computeIfAbsent(city, k -> new ArrayList<>()).add(e);
        }
        // Sehir icinde tarihe gore sirala; yalnizca tolerans penceresindeki ciftler
        // karsilastirilir (tam liste ~1000 kayit, her cifti denemek gereksiz).
        long window = Math.max(matcher.getToleranceMinutes(), LISTING_MAX_MINUTES);
        for (List<Event> sameCity : byCity.values()) {
            List<Event> dated = sameCity.stream()
                    .filter(e -> e.getEventDate() != null)
                    .sorted(Comparator.comparing(Event::getEventDate).thenComparing(Event::getId))
                    .toList();
            for (int i = 0; i < dated.size(); i++) {
                Event a = dated.get(i);
                java.time.LocalDateTime limit = a.getEventDate().plusMinutes(window);
                for (int j = i + 1; j < dated.size() && !dated.get(j).getEventDate().isAfter(limit); j++) {
                    Event b = dated.get(j);
                    if (sameConcertForListing(a, b)) union(parent, a.getId(), b.getId());
                }
            }
        }

        Map<Long, List<Event>> members = new LinkedHashMap<>();
        for (Event e : events) members.computeIfAbsent(find(parent, e.getId()), k -> new ArrayList<>()).add(e);

        Map<Long, Group> byEvent = new HashMap<>();
        for (List<Event> list : members.values()) {
            Event canonical = list.get(0);
            for (int i = 1; i < list.size(); i++) canonical = mergeService.chooseCanonical(canonical, list.get(i));
            Group g = new Group(canonical, List.copyOf(list));
            for (Event e : list) byEvent.put(e.getId(), g);
        }
        return byEvent;
    }

    /**
     * Hazir bir etkinlik listesinden ayni konserin kopyalarini ayiklar (ana sayfa,
     * harita, sanatci/mekan sayfasi, arama). Sira korunur; grubun yerinde tek
     * kayit kalir: asil kayit listedeyse o, degilse listedeki kopyalardan asil
     * kayit kuralina gore secilen. Veri degismez.
     */
    public List<Event> collapse(List<Event> events) {
        if (events == null || events.size() < 2) return events;
        Map<Long, Group> groups = group(events);
        java.util.Set<Long> inList = new java.util.HashSet<>();
        for (Event e : events) if (e != null && e.getId() != null) inList.add(e.getId());
        java.util.Set<Long> emitted = new java.util.HashSet<>();
        List<Event> out = new ArrayList<>(events.size());
        for (Event e : events) {
            if (e == null || e.getId() == null) { out.add(e); continue; }
            Group g = groups.get(e.getId());
            if (g == null || g.members().size() == 1) { out.add(e); continue; }
            Event keep = g.canonical();
            if (!inList.contains(keep.getId())) {
                keep = null;
                for (Event m : g.members()) {
                    if (inList.contains(m.getId())) keep = keep == null ? m : mergeService.chooseCanonical(keep, m);
                }
            }
            // Grubun ilk gorundugu siraya temsilciyi koy, digerlerini atla
            Long groupKey = g.canonical().getId();
            if (emitted.add(groupKey)) out.add(keep);
        }
        return out;
    }

    /** Liste icin gosterim esigi (bkz. sameConcertForListing). */
    static final long LISTING_MAX_MINUTES = 30;
    static final double LISTING_MAX_VENUE_METERS = 400;
    private static final java.util.Set<String> GENERIC_VENUE_WORDS = java.util.Set.of(
            "sahne", "sahnesi", "salon", "salonu", "arena", "hall", "stage", "club", "open", "acik", "hava",
            "acikhava", "tiyatro", "tiyatrosu", "merkezi", "merkez", "kultur", "sanat", "kongre", "sergi",
            "sarayi", "center", "centre", "theatre", "theater", "performance", "konser", "stadyumu", "park",
            "oditoryum", "oditoryumu", "auditorium", "festival", "alani",
            "istanbul", "ankara", "izmir", "antalya", "bursa", "mersin", "eskisehir", "kocaeli", "gaziantep");

    /**
     * Listede tek kart olarak gosterilsin mi?
     *
     * STRONG eslesme her zaman. Ek olarak ayni sanatci + ayni sehir + en fazla
     * 30 dk fark + mekanlar en fazla 400 m uzakta + mekan adlarinda ayirt edici
     * ortak bir kelime ("Congresium Ankara" / "ATO - Congresium Kongre ve Sergi
     * Merkezi": kaynaklar ayni kompleksi 123 m farkli koordinatla yaziyor).
     * Ayni sanatci ayni saatte iki ayri salonda sahneye cikamaz. Bu kural
     * yalnizca gosterimi etkiler; admin birlestirmesi (EventMergeService) ve
     * EventMatcher'in esikleri degismez.
     *
     * Mekan adlari ayni yerin farkli yazimiysa (bkz. sameVenueName) mesafeye
     * bakilmaz: kaynaklar ayni mekani 628 m, 2,5 km, hatta binlerce km farkli
     * koordinatla yazabiliyor.
     */
    boolean sameConcertForListing(Event a, Event b) {
        EventMatcher.MatchResult r = matcher.compare(a, b);
        if (r.isStrong()) return true;
        if (a.getEventDate() == null || b.getEventDate() == null) return false;
        long minutes = Math.abs(java.time.Duration.between(a.getEventDate(), b.getEventDate()).toMinutes());
        if (minutes > LISTING_MAX_MINUTES) return false;
        String artist = EventMatcher.artistKey(a);
        if (artist.isEmpty() || !artist.equals(EventMatcher.artistKey(b))) return false;
        if (a.getVenue() == null || b.getVenue() == null) return false;
        String city = EventMatcher.normalize(a.getVenue().getCity());
        if (city.isEmpty() || !city.equals(EventMatcher.normalize(b.getVenue().getCity()))) return false;
        if (sameVenueName(a, b, city)) return true;
        Double meters = distance(a, b);
        if (meters != null && meters > LISTING_MAX_VENUE_METERS) return false;
        return shareDistinctiveVenueWord(a, b);
    }

    /** Mekan adinda yeri belirtmeyen dolgu kelimeler (tur kelimeleri "acikhava", "arena" gibi KALIR). */
    private static final java.util.Set<String> VENUE_FILLER_WORDS = java.util.Set.of(
            "tiyatro", "tiyatrosu", "theatre", "theater", "sahne", "sahnesi", "stage",
            "alan", "alani", "the", "ve", "and");

    /**
     * Iki mekan adi ayni yerin farkli yazimi mi? Kucuk ad kumesindeki her kelime buyuk
     * kumede bulunmali ("Holly Stone Adana" ⊆ "Holly Stone Performance Hall - Adana").
     * "open air" / "acik hava" / "acikhava" tek kelimeye, ek almis kelime kokune esitlenir
     * ("otopark" ~ "otoparki"). Sehir adi ve dolgu kelimeler sayilmaz.
     * Farkli subeler ayri kalir: "Jolly Joker Atakent" / "Jolly Joker Kadikoy".
     */
    static boolean sameVenueName(Event a, Event b, String city) {
        java.util.List<String> ta = venueNameTokens(a, city);
        java.util.List<String> tb = venueNameTokens(b, city);
        if (ta.isEmpty() || tb.isEmpty()) return false;
        java.util.List<String> small = ta.size() <= tb.size() ? ta : tb;
        java.util.List<String> large = small == ta ? tb : ta;
        for (String t : small) {
            if (large.stream().noneMatch(u -> sameWord(t, u))) return false;
        }
        return true;
    }

    static java.util.List<String> venueNameTokens(Event e, String city) {
        if (e.getVenue() == null) return java.util.List.of();
        String n = " " + EventMatcher.normalize(e.getVenue().getName()) + " ";
        n = n.replace(" open air ", " acikhava ").replace(" acik hava ", " acikhava ");
        java.util.List<String> out = new ArrayList<>();
        for (String w : n.trim().split(" ")) {
            if (!w.isEmpty() && !VENUE_FILLER_WORDS.contains(w) && !w.equals(city)) out.add(w);
        }
        return out;
    }

    /** Ayni kelime ya da biri digerinin ekli hali (en az 5 harf ortak kok: "otopark"/"otoparki"). */
    private static boolean sameWord(String x, String y) {
        if (x.equals(y)) return true;
        String shorter = x.length() <= y.length() ? x : y;
        String longer = shorter == x ? y : x;
        return shorter.length() >= 5 && longer.startsWith(shorter) && longer.length() - shorter.length() <= 2;
    }

    private static Double distance(Event a, Event b) {
        var va = a.getVenue();
        var vb = b.getVenue();
        if (va.getLatitude() == null || va.getLongitude() == null
                || vb.getLatitude() == null || vb.getLongitude() == null) return null;
        return com.concertly.backend.service.EventVerificationService.distanceInMeters(
                va.getLatitude(), va.getLongitude(), vb.getLatitude(), vb.getLongitude());
    }

    private static boolean shareDistinctiveVenueWord(Event a, Event b) {
        java.util.Set<String> wordsA = venueWords(a);
        if (wordsA.isEmpty()) return false;
        for (String w : venueWords(b)) if (wordsA.contains(w)) return true;
        return false;
    }

    private static java.util.Set<String> venueWords(Event e) {
        if (e.getVenue() == null) return java.util.Set.of();
        java.util.Set<String> out = new java.util.HashSet<>();
        for (String w : EventMatcher.normalize(e.getVenue().getName()).split(" ")) {
            if (w.length() >= 5 && !GENERIC_VENUE_WORDS.contains(w)) out.add(w);
        }
        return out;
    }

    private static Long find(Map<Long, Long> parent, Long id) {
        Long p = parent.get(id);
        while (!p.equals(parent.get(p))) p = parent.get(p);
        parent.put(id, p);
        return p;
    }

    private static void union(Map<Long, Long> parent, Long a, Long b) {
        Long ra = find(parent, a);
        Long rb = find(parent, b);
        if (!ra.equals(rb)) parent.put(Math.max(ra, rb), Math.min(ra, rb));
    }
}
