package com.concertly.backend.config;

import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Türkiye'nin 81 ili ve plaka kodları. Şehir tablosu ilk açılışta buradan doldurulur;
 * bilet sitelerinin şehir adresleri (bubilet "eskisehir", BiletimGo "eskisehir-26")
 * bu bilgilerden türetilir.
 */
public final class TurkishProvinces {

    private TurkishProvinces() {}

    /** Ad → plaka (resmî sıra). */
    public static final Map<String, Integer> PLATES = new LinkedHashMap<>();

    static {
        String[] names = {
                "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Amasya", "Ankara", "Antalya", "Artvin", "Aydın",
                "Balıkesir", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı",
                "Çorum", "Denizli", "Diyarbakır", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir",
                "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Isparta", "Mersin", "İstanbul",
                "İzmir", "Kars", "Kastamonu", "Kayseri", "Kırklareli", "Kırşehir", "Kocaeli", "Konya", "Kütahya",
                "Malatya", "Manisa", "Kahramanmaraş", "Mardin", "Muğla", "Muş", "Nevşehir", "Niğde", "Ordu",
                "Rize", "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas", "Tekirdağ", "Tokat", "Trabzon",
                "Tunceli", "Şanlıurfa", "Uşak", "Van", "Yozgat", "Zonguldak", "Aksaray", "Bayburt", "Karaman",
                "Kırıkkale", "Batman", "Şırnak", "Bartın", "Ardahan", "Iğdır", "Yalova", "Karabük", "Kilis",
                "Osmaniye", "Düzce"
        };
        for (int i = 0; i < names.length; i++) PLATES.put(names[i], i + 1);
    }

    /** "Eskişehir" → "eskisehir", "İstanbul" → "istanbul" (bilet sitelerinin adres biçimi). */
    public static String slug(String name) {
        String s = name.trim()
                .replace('İ', 'I').replace('ı', 'i')
                .replace('Ş', 'S').replace('ş', 's')
                .replace('Ğ', 'G').replace('ğ', 'g')
                .replace('Ç', 'C').replace('ç', 'c')
                .replace('Ö', 'O').replace('ö', 'o')
                .replace('Ü', 'U').replace('ü', 'u');
        s = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    }

    /** Ticketmaster şehir filtresi ASCII adla daha tutarlı: "Eskişehir" → "Eskisehir". */
    public static String ascii(String name) {
        String s = slug(name);
        return s.isEmpty() ? name : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    /** Plaka (bilinmiyorsa null). Karşılaştırma Türkçe harf duyarsız. */
    public static Integer plate(String name) {
        String key = slug(name);
        for (Map.Entry<String, Integer> e : PLATES.entrySet()) {
            if (slug(e.getKey()).equals(key)) return e.getValue();
        }
        return null;
    }
}
