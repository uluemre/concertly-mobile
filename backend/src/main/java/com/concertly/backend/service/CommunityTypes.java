package com.concertly.backend.service;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Topluluk türü eşlemesi (A2).
 *
 * Kayıtlarda aynı tür farklı yazılmış olabiliyor: DataSeeder "Sehir", mobil "Şehir",
 * sunucu varsayılanı "Diger", mobil "Diğer". Veri değiştirilmeden filtre, türün tüm
 * bilinen yazımlarını aynı sayar. Karşılaştırma Java'da yapılır: Postgres LOWER()
 * "Ş"/"Ğ" gibi harfleri veritabanı yerel ayarına göre farklı çevirebilir.
 */
public final class CommunityTypes {

    /** Kod → bu türün küçük harfli tüm bilinen yazımları. */
    private static final Map<String, Set<String>> ALIASES = new LinkedHashMap<>();
    static {
        ALIASES.put("ROCK",       Set.of("rock"));
        ALIASES.put("FESTIVAL",   Set.of("festival"));
        ALIASES.put("ELECTRONIC", Set.of("elektronik", "electronic"));
        ALIASES.put("CITY",       Set.of("şehir", "sehir", "city"));
        ALIASES.put("JAZZ",       Set.of("caz", "jazz"));
        ALIASES.put("POP",        Set.of("pop"));
        ALIASES.put("RAP",        Set.of("rap"));
        ALIASES.put("OTHER",      Set.of("diğer", "diger", "other"));
    }

    private CommunityTypes() {}

    private static String key(String raw) {
        return raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
    }

    /** Bilinen türün kodu; bilinmiyorsa null. */
    public static String codeOf(String raw) {
        String k = key(raw);
        if (k.isEmpty()) return null;
        for (Map.Entry<String, Set<String>> e : ALIASES.entrySet()) {
            if (e.getValue().contains(k) || e.getKey().toLowerCase(Locale.ROOT).equals(k)) return e.getKey();
        }
        return null;
    }

    /**
     * Filtre değeri kaydın türüyle aynı tür mü? Bilinen türlerde tüm yazımlar eşleşir;
     * bilinmeyen türde büyük/küçük harf duyarsız birebir karşılaştırma yapılır.
     */
    public static boolean matches(String filter, String value) {
        String filterCode = codeOf(filter);
        if (filterCode != null) return filterCode.equals(codeOf(value));
        return !key(filter).isEmpty() && key(filter).equals(key(value));
    }
}
