package com.concertly.backend.repository;

import java.util.Locale;

/**
 * Arama metni kuralı — veritabanı sorgusu ve Java tarafı AYNI sadeleştirmeyi yapar:
 * Türkçe harfler (ç→c, ğ→g, ı/İ/I→i, ö→o, ş→s, ü→u, â/î/û) ve büyük/küçük harf farkı
 * yok sayılır; kullanıcının yazdığı % ve _ LIKE jokeri olarak yorumlanmaz.
 *
 * "I" da translate ile i'ye çevrilir: Türkçe yerelli veritabanında LOWER('I') = 'ı'
 * döndüğü için "ISTANBUL" araması "İstanbul"u bulamıyordu.
 */
public final class SearchText {

    public static final String FOLD_FROM = "ÇçĞğİIıÖöŞşÜüÂâÎîÛû";
    public static final String FOLD_TO   = "ccggiiioossuuaaiiuu";

    /** LIKE kaçış karakteri (sorgularda ESCAPE '!' ile kullanılır). */
    public static final char ESCAPE = '!';

    /** JPQL'de bir sütunun sadeleştirilmiş hali: FOLD_OPEN + "a.name" + FOLD_CLOSE */
    static final String FOLD_OPEN  = "LOWER(FUNCTION('translate', ";
    static final String FOLD_CLOSE = ", '" + FOLD_FROM + "', '" + FOLD_TO + "'))";

    private SearchText() {}

    /** Sütun tarafıyla aynı kural: Türkçe harfleri sadeleştirir, küçük harfe çevirir. */
    public static String fold(String s) {
        StringBuilder sb = new StringBuilder(s.length());
        for (char c : s.toCharArray()) {
            int i = FOLD_FROM.indexOf(c);
            sb.append(i >= 0 ? FOLD_TO.charAt(i) : c);
        }
        return sb.toString().toLowerCase(Locale.ROOT);
    }

    /**
     * Sanatçı kimlik anahtarı: sadeleştirilmiş ad, harf ve rakam dışı her şey atılır.
     * "Şebnem Ferah" = "Sebnem Ferah", "Levi Sct." = "Levi .Sct", "mor ve ötesi" = "Mor ve Otesi".
     */
    public static String nameKey(String name) {
        return name == null ? "" : fold(name).replaceAll("[^a-z0-9]", "");
    }

    /** "içinde geçer" deseni: %, _ ve kaçış karakteri birebir aranır. */
    public static String containsPattern(String q) {
        String folded = fold(q);
        StringBuilder sb = new StringBuilder(folded.length() + 2).append('%');
        for (char c : folded.toCharArray()) {
            if (c == ESCAPE || c == '%' || c == '_') sb.append(ESCAPE);
            sb.append(c);
        }
        return sb.append('%').toString();
    }
}
