package com.concertly.backend.service.ingest;

import com.concertly.backend.model.Event;
import com.concertly.backend.repository.SearchText;
import com.concertly.backend.service.EventVerificationService;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.BinaryOperator;
import java.util.function.Function;

/**
 * Mukerrer sanatci / mekan / etkinlik tespitinin SAF mantigi (N-08 / N-09).
 *
 * Veritabanina ya da servislere dokunmaz; yalnizca verilen adaylari gruplar.
 * Her eslesme bir sebep (reason) ve guven seviyesi (confidence) tasir.
 *
 * Gruplar YILDIZ bicimindedir: her mukerrer dogrudan asil kayitla eslesir; A~B ve B~C
 * oldugu icin A~C varsayilmaz (zincirleme yanlis birlestirmeyi onler).
 */
public final class DuplicateDetector {

    /** Ayni etkinlik sayilacak en buyuk saat farki (dakika). Ayni gun farkli saat = ayri gosteri. */
    public static final long EVENT_WINDOW_MINUTES = 60;
    /** Bu farka kadar olan etkinlik cifti HIGH, ustu MEDIUM. */
    static final long EVENT_HIGH_MINUTES = 15;
    /** Mekanlar arasi "ayni yer" mesafe esigi (metre). */
    public static final double VENUE_NEAR_METERS = 300;

    private DuplicateDetector() {}

    // ───────────────────────── tipler ─────────────────────────

    public record ArtistCandidate(Long id, String name, boolean hasSpotifyId,
                                  long upcomingEvents, long followers, long totalEvents) {}

    public record VenueCandidate(Long id, String name, String city, Double latitude, Double longitude,
                                 long events, boolean hasExternalId) {
        boolean hasCoordinates() { return latitude != null && longitude != null; }
    }

    public record Match<T>(T duplicate, String reason, MergeConfidence confidence) {}

    public record Group<T>(T canonical, List<Match<T>> duplicates) {}

    public record EventMatch(Event duplicate, long minutesApart, String reason, MergeConfidence confidence) {}

    public record EventCluster(Event canonical, List<EventMatch> duplicates) {}

    // ───────────────────────── sanatci ─────────────────────────

    /**
     * Genis ad anahtari: Turkce harf/buyuk-kucuk/noktalama yok sayilir (SearchText.fold),
     * bastaki "the " atilir, "&", "+", "ve", "and" tek bagla esitlenir.
     * "The Weeknd" = "Weeknd"; "Mor ve Otesi" = "Mor & Otesi" = "Mor and Otesi".
     */
    public static String wideKey(String name) {
        if (name == null) return "";
        String s = SearchText.fold(name).replace("&", " and ").replace("+", " and ");
        List<String> tokens = new ArrayList<>();
        for (String t : s.split("[^a-z0-9]+")) {
            if (t.isEmpty()) continue;
            tokens.add(t.equals("ve") || t.equals("and") ? "and" : t);
        }
        if (tokens.size() > 1 && tokens.get(0).equals("the")) tokens.remove(0);
        return String.join("", tokens);
    }

    /** Asil sanatci sirasi: Spotify kimligi > yaklasan etkinlik > takipci > toplam etkinlik > kucuk id. */
    static final Comparator<ArtistCandidate> ARTIST_RANK = Comparator
            .comparing((ArtistCandidate a) -> !a.hasSpotifyId())
            .thenComparing(Comparator.comparingLong(ArtistCandidate::upcomingEvents).reversed())
            .thenComparing(Comparator.comparingLong(ArtistCandidate::followers).reversed())
            .thenComparing(Comparator.comparingLong(ArtistCandidate::totalEvents).reversed())
            .thenComparing(ArtistCandidate::id);

    public static List<Group<ArtistCandidate>> groupArtists(Collection<ArtistCandidate> all, MergeConfidence min) {
        Map<String, List<ArtistCandidate>> buckets = new LinkedHashMap<>();
        for (ArtistCandidate a : all) {
            if (a == null || a.id() == null || SearchText.nameKey(a.name()).isEmpty()) continue;
            String key = wideKey(a.name());
            if (key.isEmpty()) continue;
            buckets.computeIfAbsent(key, k -> new ArrayList<>()).add(a);
        }
        List<Group<ArtistCandidate>> groups = new ArrayList<>();
        for (List<ArtistCandidate> bucket : buckets.values()) {
            if (bucket.size() < 2) continue;
            List<ArtistCandidate> sorted = new ArrayList<>(bucket);
            sorted.sort(ARTIST_RANK);
            ArtistCandidate canonical = sorted.get(0);
            List<Match<ArtistCandidate>> dups = new ArrayList<>();
            for (ArtistCandidate other : sorted.subList(1, sorted.size())) {
                boolean sameNameKey = SearchText.nameKey(canonical.name()).equals(SearchText.nameKey(other.name()));
                MergeConfidence conf = sameNameKey ? MergeConfidence.HIGH : MergeConfidence.MEDIUM;
                if (!conf.atLeast(min)) continue;
                String reason = sameNameKey
                        ? "NAME_KEY: ad anahtari ayni (Turkce harf / buyuk-kucuk / noktalama farki)"
                        : "WIDE_NAME: bastaki 'the' veya & / ve / and farki disinda ayni ad";
                dups.add(new Match<>(other, reason, conf));
            }
            if (!dups.isEmpty()) groups.add(new Group<>(canonical, dups));
        }
        return groups;
    }

    private static final String TURKISH_LETTERS = "çğıöşüÇĞÖŞÜİ";

    /**
     * Gruptaki en iyi yazilmis ad (yalnizca asil ile AYNI nameKey'e sahip HIGH mukerrerler dikkate alinir;
     * MEDIUM wideKey eslesmelerinin adi asla alinmaz). Once buyuk/kucuk harf kalitesi (karisik/Proper Case,
     * tamami kucuk veya tamami buyuk olana gore), sonra daha cok Turkce harf (cgiosuI); esitlikte asilin adi.
     * @return degisiklik gerekmiyorsa asilin adi
     */
    public static String preferredArtistName(Group<ArtistCandidate> group) {
        List<String> names = new ArrayList<>();
        names.add(group.canonical().name());
        String key = SearchText.nameKey(group.canonical().name());
        for (Match<ArtistCandidate> m : group.duplicates()) {
            if (m.confidence() == MergeConfidence.HIGH && key.equals(SearchText.nameKey(m.duplicate().name()))) {
                names.add(m.duplicate().name());
            }
        }
        return bestArtistName(names);
    }

    /** names[0] asil addir; esitlikte o korunur. Tum adlar ayni nameKey'e sahip olmalidir. */
    public static String bestArtistName(List<String> names) {
        String best = names.get(0);
        for (String n : names.subList(1, names.size())) {
            if (n == null || n.isBlank()) continue;
            boolean nGood = isMixedCase(n), bGood = isMixedCase(best);
            if (nGood != bGood) { if (nGood) best = n; continue; }
            if (turkishLetterCount(n) > turkishLetterCount(best)) best = n;
        }
        return best;
    }

    private static boolean isMixedCase(String s) {
        boolean lower = false, upper = false;
        for (char c : s.toCharArray()) {
            if (Character.isLowerCase(c)) lower = true;
            else if (Character.isUpperCase(c)) upper = true;
        }
        return lower && upper;
    }

    private static int turkishLetterCount(String s) {
        int n = 0;
        for (char c : s.toCharArray()) if (TURKISH_LETTERS.indexOf(c) >= 0) n++;
        return n;
    }

    // ───────────────────────── mekan ─────────────────────────

    /**
     * Asil mekan sirasi: etkinligi cok olan > kaynak kimligi olan > koordinati olan > kucuk id.
     * Koordinat TEK BASINA kazandirmaz (kaynaklar yanlis koordinat yazabiliyor); eksik alanlar yine mukerrerden doldurulur.
     */
    static final Comparator<VenueCandidate> VENUE_RANK = Comparator
            .comparing(VenueCandidate::events, Comparator.reverseOrder())
            .thenComparing(v -> !v.hasExternalId())
            .thenComparing(v -> !v.hasCoordinates())
            .thenComparing(VenueCandidate::id);

    public static List<Group<VenueCandidate>> groupVenues(Collection<VenueCandidate> all, MergeConfidence min) {
        // Farkli sehirler asla karsilastirilmaz: once sehre gore kovala.
        Map<String, List<VenueCandidate>> byCity = new LinkedHashMap<>();
        for (VenueCandidate v : all) {
            if (v == null || v.id() == null) continue;
            String city = SearchText.nameKey(v.city());
            if (city.isEmpty() || EventMatcher.normalize(v.name()).isEmpty()) continue;
            byCity.computeIfAbsent(city, k -> new ArrayList<>()).add(v);
        }
        List<Group<VenueCandidate>> groups = new ArrayList<>();
        for (List<VenueCandidate> sameCity : byCity.values()) {
            if (sameCity.size() < 2) continue;
            List<VenueCandidate> sorted = new ArrayList<>(sameCity);
            sorted.sort(VENUE_RANK);
            Set<Long> assigned = new HashSet<>();
            for (int i = 0; i < sorted.size(); i++) {
                VenueCandidate center = sorted.get(i);
                if (assigned.contains(center.id())) continue;
                List<Match<VenueCandidate>> dups = new ArrayList<>();
                for (int j = i + 1; j < sorted.size(); j++) {
                    VenueCandidate other = sorted.get(j);
                    if (assigned.contains(other.id())) continue;
                    Optional<Match<VenueCandidate>> m = matchVenues(center, other);
                    if (m.isPresent() && m.get().confidence().atLeast(min)) {
                        dups.add(m.get());
                        assigned.add(other.id());
                    }
                }
                if (!dups.isEmpty()) groups.add(new Group<>(center, dups));
            }
        }
        return groups;
    }

    /**
     * Iki mekan ayni yer mi? Sonuc "duplicate" tarafi olarak {@code other}'i tasir.
     * Farkli (ya da bos) sehirde HICBIR zaman eslesmez.
     */
    public static Optional<Match<VenueCandidate>> matchVenues(VenueCandidate canonical, VenueCandidate other) {
        String cityA = SearchText.nameKey(canonical.city());
        if (cityA.isEmpty() || !cityA.equals(SearchText.nameKey(other.city()))) return Optional.empty();
        String nameA = EventMatcher.normalize(canonical.name());
        String nameB = EventMatcher.normalize(other.name());
        if (nameA.isEmpty() || nameB.isEmpty()) return Optional.empty();

        // 1) birebir ayni (katlanmis) ad
        if (nameA.equals(nameB)) {
            return hit(other, "EXACT_NAME: ayni sehir, ayni ad (harf / noktalama farki yok sayildi)", MergeConfidence.HIGH);
        }

        String city = EventMatcher.normalize(canonical.city());
        // 1b) HIGH: salon/sahne/oditoryum/hall/studio/numara gibi ayirt edici kelimeler ASLA dusurulmez; kelime kumesi birebir
        //     ayni olmali. Yalnizca sehir adi, the/ve/and atilir; "open air"="acikhava", "acikhava tiyatrosu"="acikhava",
        //     salonu=salon, sahnesi=sahne, stage=sahne ekleri esitlenir.
        Set<String> sa = strictVenueTokens(canonical.name(), city);
        if (!sa.isEmpty() && sa.equals(strictVenueTokens(other.name(), city))) {
            return hit(other, "SAME_VENUE_NAME: ayni sehir, ayni ad kelimeleri (salon/sahne kelimeleri korunarak; open air = acikhava)",
                    MergeConfidence.HIGH);
        }

        // Asagidaki eslesmeler yalnizca ONERIdir (MEDIUM/LOW): farkli salon/sahne olabilir, toplu apply uygulamaz.
        List<String> ta = ConcertGrouping.venueNameTokens(canonical.name(), city);
        List<String> tb = ConcertGrouping.venueNameTokens(other.name(), city);
        if (!ta.isEmpty() && !tb.isEmpty()) {
            List<String> small = ta.size() <= tb.size() ? ta : tb;
            boolean distinctive = small.stream().anyMatch(t -> t.length() >= 3 && !ConcertGrouping.isGenericVenueWord(t));
            if (distinctive) {
                // 3) biri digerinin kelimelerini tamamen iceriyor ("Zorlu PSM" / "Zorlu PSM Turkcell Sahnesi")
                if (ConcertGrouping.sameVenueName(canonical.name(), other.name(), city)) {
                    return hit(other, "NAME_CONTAINS_TOKENS: bir ad digerinin tum ayirt edici kelimelerini iceriyor (farkli salon olabilir)",
                            MergeConfidence.MEDIUM);
                }
                String ja = String.join("", ta);
                String jb = String.join("", tb);
                String shorter = ja.length() <= jb.length() ? ja : jb;
                String longer = shorter == ja ? jb : ja;
                if (shorter.length() >= 5 && longer.contains(shorter)) {
                    return hit(other, "NAME_CONTAINS: bir ad (sehir / dolgu kelimeler atilinca) digerinin icinde geciyor",
                            MergeConfidence.MEDIUM);
                }
            }
        }

        // 4) <= 300 m + ortak ayirt edici kelime
        if (canonical.hasCoordinates() && other.hasCoordinates()) {
            double meters = EventVerificationService.distanceInMeters(canonical.latitude(), canonical.longitude(),
                    other.latitude(), other.longitude());
            if (meters <= VENUE_NEAR_METERS && shareDistinctiveWord(nameA, nameB, city)) {
                return hit(other, "NEAR_AND_SHARED_WORD: " + Math.round(meters) + " m yakin ve adlarda ortak ayirt edici kelime var",
                        MergeConfidence.LOW);
            }
        }
        return Optional.empty();
    }

    /** Salon/sahne ayirt edici kelimeleri korunan siki kelime kumesi (HIGH yolu). */
    static Set<String> strictVenueTokens(String name, String city) {
        String n = " " + EventMatcher.normalize(name) + " ";
        n = n.replace(" open air ", " acikhava ").replace(" acik hava ", " acikhava ")
                .replace(" acikhava tiyatrosu ", " acikhava ").replace(" acikhava tiyatro ", " acikhava ");
        Set<String> out = new java.util.TreeSet<>();
        for (String w : n.trim().split(" ")) {
            if (w.isEmpty() || w.equals(city) || w.equals("the") || w.equals("ve") || w.equals("and")) continue;
            out.add(switch (w) {
                case "salonu" -> "salon";
                case "sahnesi" -> "sahne";
                case "oditoryumu" -> "oditoryum";
                case "tiyatrosu" -> "tiyatro";
                case "stage" -> "sahne";
                default -> w;
            });
        }
        return out;
    }

    private static Optional<Match<VenueCandidate>> hit(VenueCandidate dup, String reason, MergeConfidence c) {
        return Optional.of(new Match<>(dup, reason, c));
    }

    private static boolean shareDistinctiveWord(String nameA, String nameB, String city) {
        Set<String> wa = new HashSet<>();
        for (String w : nameA.split(" ")) {
            if (w.length() >= 4 && !w.equals(city) && !ConcertGrouping.isGenericVenueWord(w)) wa.add(w);
        }
        for (String w : nameB.split(" ")) {
            if (w.length() >= 4 && wa.contains(w)) return true;
        }
        return false;
    }

    // ───────────────────────── etkinlik ─────────────────────────

    /**
     * Ayni (asil) sanatci + ayni (asil) mekan + en fazla 60 dk fark = ayni konser.
     * Ayni gunun farkli saatleri AYRI gosteridir, birlestirilmez.
     *
     * Kume, en erken etkinlik (anchor) etrafinda kurulur: her uye anchor'a en fazla 60 dk
     * uzakta olmalidir (zincirleme 20:00-20:50-21:40 tek kume olmaz).
     *
     * @param events      yalnizca yayinda, birlestirilmemis etkinlikler
     * @param artistRoot  etkinligin sanatci kimligini asil kimlige cevirir (birlestirme oncesi sanal esleme)
     * @param venueRoot   mekan icin ayni
     * @param artistConf  yeniden eslenen sanatci id'sinin guveni (eslenmeyen = HIGH sayilir)
     * @param venueConf   mekan icin ayni
     * @param chooser     iki etkinlikten asil olani secer (EventMergeService.chooseCanonical)
     */
    public static List<EventCluster> clusterEvents(Collection<Event> events,
                                                   Function<Long, Long> artistRoot, Function<Long, Long> venueRoot,
                                                   Map<Long, MergeConfidence> artistConf,
                                                   Map<Long, MergeConfidence> venueConf,
                                                   MergeConfidence min, BinaryOperator<Event> chooser) {
        Map<String, List<Event>> byKey = new LinkedHashMap<>();
        for (Event e : events) {
            if (e == null || e.getId() == null || e.getEventDate() == null
                    || e.getArtist() == null || e.getVenue() == null) continue;
            String key = artistRoot.apply(e.getArtist().getId()) + "|" + venueRoot.apply(e.getVenue().getId());
            byKey.computeIfAbsent(key, k -> new ArrayList<>()).add(e);
        }
        List<EventCluster> clusters = new ArrayList<>();
        for (List<Event> list : byKey.values()) {
            if (list.size() < 2) continue;
            List<Event> sorted = new ArrayList<>(list);
            sorted.sort(Comparator.comparing(Event::getEventDate).thenComparing(Event::getId));
            Set<Long> used = new HashSet<>();
            for (int i = 0; i < sorted.size(); i++) {
                Event anchor = sorted.get(i);
                if (used.contains(anchor.getId())) continue;
                List<EventMatch> members = new ArrayList<>();
                for (int j = i + 1; j < sorted.size(); j++) {
                    Event other = sorted.get(j);
                    if (used.contains(other.getId())) continue;
                    long minutes = Math.abs(Duration.between(anchor.getEventDate(), other.getEventDate()).toMinutes());
                    if (minutes > EVENT_WINDOW_MINUTES) break; // tarihe gore sirali: ilerisi daha da uzak
                    MergeConfidence conf = minutes <= EVENT_HIGH_MINUTES ? MergeConfidence.HIGH : MergeConfidence.MEDIUM;
                    conf = lowerOfMaps(conf, anchor, other, artistConf, venueConf);
                    if (ticketProductTitlesDiffer(anchor.getName(), other.getName())) {
                        conf = MergeConfidence.lower(conf, MergeConfidence.MEDIUM); // farkli bilet urunu: yalnizca oneri
                    }
                    if (!conf.atLeast(min)) continue;
                    members.add(new EventMatch(other, minutes,
                            "SAME_ARTIST_VENUE: ayni sanatci ve mekan, " + minutes + " dk fark", conf));
                    used.add(other.getId());
                }
                if (members.isEmpty()) continue;
                used.add(anchor.getId());

                Event canonical = anchor;
                for (EventMatch m : members) canonical = chooser.apply(canonical, m.duplicate());

                List<EventMatch> dups = new ArrayList<>();
                if (!canonical.getId().equals(anchor.getId())) {
                    // anchor mukerrer olur; guven/fark bilgisi asil ile arasindaki eslesmeden alinir
                    final Long canonId = canonical.getId();
                    EventMatch link = members.stream()
                            .filter(m -> m.duplicate().getId().equals(canonId)).findFirst().orElse(members.get(0));
                    dups.add(new EventMatch(anchor, link.minutesApart(), link.reason(), link.confidence()));
                }
                for (EventMatch m : members) {
                    if (!m.duplicate().getId().equals(canonical.getId())) dups.add(m);
                }
                clusters.add(new EventCluster(canonical, dups));
            }
            // Saat dilimi kayması: aynı site + aynı sayfa + tam 3 saat (bkz. timeShiftTwin)
            for (Event late : sorted) {
                if (used.contains(late.getId())) continue;
                for (Event early : sorted) {
                    if (early == late || used.contains(early.getId())) continue;
                    if (!timeShiftTwin(early, late)) continue;
                    MergeConfidence conf = lowerOfMaps(MergeConfidence.HIGH, early, late, artistConf, venueConf);
                    if (!conf.atLeast(min)) continue;
                    clusters.add(new EventCluster(early, List.of(new EventMatch(late, TIME_SHIFT_MINUTES,
                            "TIME_SHIFT: ayni site ve sayfa, tam 3 saat ileri kaymis kopya", conf))));
                    used.add(early.getId());
                    used.add(late.getId());
                    break;
                }
            }
        }
        return clusters;
    }

    /**
     * Doğru saatli ikizi daha önce başka bir kayda BİRLEŞTİRİLMİŞ kayık kopyalar: ikiz aday
     * listesinde olmadığı için kümelemede görünmez. İkizin kimliğinden (aynı sayfa, 3 saat
     * önce) bulunur, birleştirme zinciri asıl kayda kadar izlenir ve kopya oraya bağlanır.
     *
     * @param all        tüm etkinlikler (birleştirilmiş olanlar dahil)
     * @param candidates yayında ve birleştirilmemiş etkinlikler
     * @param clustered  kümelemede zaten yer alan etkinlik kimlikleri
     */
    public static List<EventCluster> timeShiftOrphans(Collection<Event> all, Collection<Event> candidates,
                                                      Set<Long> clustered, MergeConfidence min) {
        if (!MergeConfidence.HIGH.atLeast(min)) return List.of();
        Map<String, Event> byExternalId = new HashMap<>();
        Map<Long, Event> byId = new HashMap<>();
        for (Event e : all) {
            if (e == null || e.getId() == null) continue;
            byId.put(e.getId(), e);
            if (e.getExternalId() != null) byExternalId.putIfAbsent(e.getExternalId(), e);
        }
        Map<Long, List<EventMatch>> byRoot = new LinkedHashMap<>();
        for (Event late : candidates) {
            if (late.getId() == null || clustered.contains(late.getId()) || late.getEventDate() == null) continue;
            int hour = late.getEventDate().getHour();
            if (!(hour >= 22 || hour < 4)) continue;
            String suffix = "@" + late.getEventDate();
            String ext = late.getExternalId();
            if (ext == null || !ext.endsWith(suffix)) continue;
            Event twin = byExternalId.get(ext.substring(0, ext.length() - suffix.length())
                    + "@" + late.getEventDate().minusMinutes(TIME_SHIFT_MINUTES));
            if (twin == null || twin.getSource() != late.getSource()) continue;
            Event root = twin;
            for (int guard = 0; root.getMergedIntoEventId() != null && guard < 10; guard++) {
                Event next = byId.get(root.getMergedIntoEventId());
                if (next == null) break;
                root = next;
            }
            if (root.getId().equals(late.getId()) || clustered.contains(root.getId()) || !root.listedPublicly()) continue;
            byRoot.computeIfAbsent(root.getId(), k -> new ArrayList<>()).add(new EventMatch(late, TIME_SHIFT_MINUTES,
                    "TIME_SHIFT: ayni site ve sayfa, tam 3 saat ileri kaymis kopya (ikizi daha once birlestirilmis)",
                    MergeConfidence.HIGH));
        }
        List<EventCluster> out = new ArrayList<>();
        for (Map.Entry<Long, List<EventMatch>> e : byRoot.entrySet()) {
            out.add(new EventCluster(byId.get(e.getKey()), e.getValue()));
        }
        return out;
    }

    /** Türkiye saati ile UTC farkı: kayan kopya tam bu kadar ileride. */
    static final long TIME_SHIFT_MINUTES = 180;

    /**
     * Saat dilimi kayması kopyası mı? Biletinial bir dönem saati UTC gibi verdi; aynı seans
     * 21:00 ve ertesi gün 00:00 olarak iki kayıt açıldı (kimlik saati içerdiği için). İkisi de
     * aynı siteden, aynı etkinlik sayfasından gelir ve tam 3 saat aralıklıdır; geç olanın saati
     * gece yarısı civarındadır (gerçek matine / akşam seansları bu imzayı taşımaz).
     */
    static boolean timeShiftTwin(Event early, Event late) {
        if (early.getSource() == null || early.getSource() != late.getSource()) return false;
        if (early.getEventDate() == null || late.getEventDate() == null) return false;
        if (Duration.between(early.getEventDate(), late.getEventDate()).toMinutes() != TIME_SHIFT_MINUTES) return false;
        int hour = late.getEventDate().getHour();
        if (!(hour >= 22 || hour < 4)) return false;
        String a = pageKey(early.getExternalId()), b = pageKey(late.getExternalId());
        return a != null && a.equals(b);
    }

    /** "biletinial:slug@2026-10-10T20:30" → "biletinial:slug" (seans kısmı atılır). */
    static String pageKey(String externalId) {
        if (externalId == null) return null;
        int at = externalId.indexOf('@');
        return at > 0 ? externalId.substring(0, at) : null;
    }

    /**
     * Basliklar (katlanmis) farkliysa ve en az biri bilet-urunu isareti tasiyorsa true
     * ("... - Persembe" ile "... - VIP Gunluk Bilet - Diledigin Bir Gun" ayni gosteri olmayabilir).
     * Ozdes basliklar etkilenmez.
     */
    static boolean ticketProductTitlesDiffer(String a, String b) {
        List<String> ta = titleTokens(a), tb = titleTokens(b);
        if (ta.equals(tb)) return false;
        return hasTicketMarker(ta) || hasTicketMarker(tb);
    }

    private static List<String> titleTokens(String title) {
        List<String> out = new ArrayList<>();
        if (title == null) return out;
        for (String t : SearchText.fold(title).split("[^a-z0-9]+")) if (!t.isEmpty()) out.add(t);
        return out;
    }

    private static boolean hasTicketMarker(List<String> tokens) {
        for (int i = 0; i < tokens.size(); i++) {
            String t = tokens.get(i);
            if (t.equals("vip") || t.equals("ticket") || t.equals("tickets") || t.equals("backstage")
                    || t.startsWith("kombine") || t.startsWith("paket") || t.startsWith("package")
                    || t.startsWith("gunluk") || t.startsWith("diledigin")
                    || (t.startsWith("bilet") && !t.startsWith("biletinial"))) return true;
            if (t.equals("her") && i + 1 < tokens.size() && tokens.get(i + 1).equals("gun")) return true;
            if (t.equals("meet") && tokens.subList(i + 1, tokens.size()).stream().anyMatch(x -> x.equals("greet"))) return true;
        }
        return false;
    }

    private static MergeConfidence lowerOfMaps(MergeConfidence conf, Event a, Event b,
                                               Map<Long, MergeConfidence> artistConf,
                                               Map<Long, MergeConfidence> venueConf) {
        MergeConfidence c = conf;
        for (Event e : List.of(a, b)) {
            MergeConfidence ac = artistConf.get(e.getArtist().getId());
            if (ac != null) c = MergeConfidence.lower(c, ac);
            MergeConfidence vc = venueConf.get(e.getVenue().getId());
            if (vc != null) c = MergeConfidence.lower(c, vc);
        }
        return c;
    }
}
