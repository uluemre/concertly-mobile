package com.concertly.backend.service.ingest;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Konser olmayan etkinlikleri adından tanır (N-16).
 *
 * Ticketmaster'ın "Music" segment filtresi yetmiyor: TM bazı müzikal, tiyatro ve
 * stand-up kayıtlarını da Music altında veriyor ("Gırgıriye Müzikali" → Music/Pop).
 * Biletinial'da ise hiç müzik kontrolü yoktu.
 *
 * Kural bilerek MUHAFAZAKÂR: gerçek bir konseri gizlemek, listede bir müzikal
 * görmekten daha kötü. Bu yüzden
 *  - yalnızca tam kelime (kelime sınırlı) eşleşir — "oyun" başka kelimenin parçası olamaz;
 *  - adında açık bir müzik kelimesi (konser, orkestra…) geçen etkinlik asla elenmez;
 *  - etkinlik adına yazılmış mekan ifadeleri ("Açıkhava Tiyatrosu", "Kongre ve Sergi
 *    Merkezi") kontrolden önce çıkarılır;
 *  - DJ set, "90'lar pop partisi", Oktoberfest, gazino gecesi, festivaller ELENMEZ.
 *
 * Karşılaştırma EventMatcher.normalize ile yapılır: Türkçe harfler sadeleşir,
 * noktalama boşluğa döner ("Stand-Up" → "stand up", "Müzikali" → "muzikali").
 */
public final class NonMusicFilter {

    /** Listeden kaldırma gerekçesi (V5 events.delisted_reason). */
    public static final String REASON = "NOT_MUSIC";

    /** Müzik dışı işaretleri — tam kelime / kelime grubu. */
    private static final List<Pattern> NON_MUSIC = List.of(
            word("stand up"),
            word("standup"),
            word("muzikal(i|leri|ler)?"),
            word("tiyatro(su|lari|lar)?"),
            word("komedi(si|ler)?"),
            word("sihirbaz(i|lik)?"),
            word("illuzyon(ist|u)?"),
            word("soylesi(si)?"),
            word("atolye(si)?"),
            word("sergi(si)?"),
            word("cinayet(ler|leri)?( [a-z0-9]+){0,3} kumpanya(si)?"),
            word("oyun"));

    /** Bunlardan biri geçiyorsa etkinlik müziktir; asla elenmez. */
    private static final Pattern MUSIC = word(
            "konser(i|leri|ler)?|concert|orkestra(si)?|orchestra|senfoni|symphony|resital(i)?|recital");

    /** Etkinlik adına yazılmış mekan ifadeleri: tür kelimesi ("tiyatro", "sergi") içerseler de mekandır. */
    private static final Pattern VENUE_PHRASES = Pattern.compile(
            "\\b(acik hava|acikhava|amfi|open air) tiyatro(su|lari)?\\b"
                    + "|\\bkongre ve sergi (merkezi|sarayi)\\b|\\bsergi (merkezi|sarayi|alani)\\b");

    private NonMusicFilter() {}

    /** Etkinlik adı müzik dışı bir etkinliği mi gösteriyor? */
    public static boolean isNonMusic(String eventName) {
        String name = EventMatcher.normalize(eventName);
        if (name.isEmpty() || MUSIC.matcher(name).find()) return false;
        name = VENUE_PHRASES.matcher(name).replaceAll(" ");
        for (Pattern p : NON_MUSIC) {
            if (p.matcher(name).find()) return true;
        }
        return false;
    }

    private static Pattern word(String regex) {
        return Pattern.compile("(?<![a-z0-9])(" + regex + ")(?![a-z0-9])");
    }
}
