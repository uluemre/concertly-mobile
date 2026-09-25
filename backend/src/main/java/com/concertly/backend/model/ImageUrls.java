package com.concertly.backend.model;

/**
 * Gorsel adreslerinin "gercekten gosterilecek bir fotograf" olup olmadigi.
 *
 * Deezer, fotografi olmayan sanatcilar icin gri bir silüet dondurur; adresi
 * bos dosyanin MD5'ini (d41d8cd9...) tasir. Bu adres veritabanina sanatci
 * fotografi olarak yazilmis (mor ve otesi, Sufle...) ve uygulamada kart
 * "fotograf yok" gibi bos gorunuyordu. Veri degistirilmeden API cevabinda
 * yok sayilir; boylece uygulama kendi yer tutucusunu gosterir.
 */
public final class ImageUrls {

    private static final String[] PLACEHOLDER_MARKERS = {
            "d41d8cd98f00b204e9800998ecf8427e",   // Deezer: resmi olmayan sanatci
            "/images/artist//",                   // Deezer: bos hash
            "default_avatar",
    };

    private ImageUrls() {}

    public static boolean isPlaceholder(String url) {
        if (url == null || url.isBlank()) return true;
        for (String marker : PLACEHOLDER_MARKERS) {
            if (url.contains(marker)) return true;
        }
        return false;
    }

    /** Kullanilabilir adres ya da null. */
    public static String usable(String url) {
        return isPlaceholder(url) ? null : url;
    }
}
