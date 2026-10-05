package com.concertly.backend.service.ingest;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * BiletimGo okuyucusu.
 *
 * Bu sitede schema.org verisi yok; sayfa sunucuda düz HTML olarak üretiliyor. Keşif
 * şehir takvimi sayfasından ve konser filtresiyle yapılıyor (/etkinlik-takvimi-istanbul-34
 * ?kategori=konser): yalnız yaklaşan konserler listelenir, site haritasını taramaya
 * gerek kalmaz. Ayrıntılar etkinlik sayfasının "Etkinlik Bilgileri" kutusundan okunur.
 *
 * HTML'den okunduğu için site tasarımı değişirse kırılabilir; o zaman kaynak sağlığı
 * ekranı "hiç kayıt gelmedi" uyarısı verir.
 */
@Service
public class BiletimGoSource {

    public static final String SOURCE = "BILETIMGO";

    static final String BASE_URL = "https://www.biletimgo.com";
    private static final String CITY_CALENDAR = BASE_URL + "/etkinlik-takvimi-%s?kategori=konser";

    private static final Pattern EVENT_LINK = Pattern.compile("etkinlik/([a-z0-9-]+-(\\d+))\"");
    private static final Pattern OG = Pattern.compile("<meta\\s+property=\"og:(title|image)\"\\s+content=\"([^\"]*)\"");
    private static final Pattern START = Pattern.compile(
            "etkilikbilgibaslik\">\\s*Başlangıç\\s*</span>\\s*([^<]+?)\\s*</span>", Pattern.DOTALL);
    private static final Pattern VENUE = Pattern.compile(
            "<a href=\"[./]*mekan/[a-z0-9-]+\">([^<]+)</a>\\s*</span>\\s*([^<]+?)\\s*</span>", Pattern.DOTALL);
    /** "Ekim 28, 2026 22:00" */
    private static final Pattern DATE_TEXT = Pattern.compile("(\\p{L}+)\\s+(\\d{1,2}),\\s*(\\d{4})\\s+(\\d{1,2}):(\\d{2})");

    private static final Map<String, Integer> MONTHS = Map.ofEntries(
            Map.entry("ocak", 1), Map.entry("şubat", 2), Map.entry("mart", 3), Map.entry("nisan", 4),
            Map.entry("mayıs", 5), Map.entry("haziran", 6), Map.entry("temmuz", 7), Map.entry("ağustos", 8),
            Map.entry("eylül", 9), Map.entry("ekim", 10), Map.entry("kasım", 11), Map.entry("aralık", 12));

    private static final Locale TR = Locale.forLanguageTag("tr");

    private final PoliteFetcher fetcher;

    public BiletimGoSource(RestTemplateBuilder builder,
            @Value("${app.sources.biletimgo.user-agent:" + PoliteFetcher.DEFAULT_USER_AGENT + "}") String userAgent,
            @Value("${app.sources.biletimgo.delay-ms:1000}") long politeDelayMs,
            @Value("${app.sources.biletimgo.max-retries:2}") int maxRetries) {
        this.fetcher = new PoliteFetcher("BiletimGo", builder, userAgent, politeDelayMs, maxRetries);
    }

    /** Bir şehrin konser takvimindeki etkinlik adresleri (cityCode ör. istanbul-34). */
    public List<String> listConcertUrls(String cityCode) {
        String html = fetcher.get(String.format(CITY_CALENDAR, cityCode));
        fetcher.politePause();
        return html == null ? List.of() : extractEventUrls(html);
    }

    static List<String> extractEventUrls(String html) {
        Set<String> urls = new LinkedHashSet<>();
        Matcher m = EVENT_LINK.matcher(html);
        while (m.find()) urls.add(BASE_URL + "/etkinlik/" + m.group(1));
        return new ArrayList<>(urls);
    }

    /** Etkinlik sayfasını okur; okunamazsa null. */
    public RawConcertData fetchEvent(String url) {
        String html = fetcher.get(url);
        fetcher.politePause();
        return html == null ? null : parseEvent(html, url);
    }

    static RawConcertData parseEvent(String html, String pageUrl) {
        Map<String, String> og = new HashMap<>();
        Matcher m = OG.matcher(html);
        while (m.find()) og.putIfAbsent(m.group(1), NameCase.decodeEntities(m.group(2)));

        Matcher start = START.matcher(html);
        LocalDateTime startsAt = start.find() ? parseDate(start.group(1)) : null;
        if (startsAt == null) return null;

        Matcher venue = VENUE.matcher(html);
        if (!venue.find()) return null;
        String venueName = clean(venue.group(1));
        String address = clean(venue.group(2));

        String title = og.get("title");
        if (title != null) title = title.replaceFirst("\\s*[–-]\\s*Biletler ve Detaylar\\s*$", "");
        // Başlık büyük harfle geliyor; doğru yazım açıklama metninden alınır
        String name = NameCase.properName(clean(title), descriptionText(html));
        if (name == null) return null;
        String city = cityFromAddress(address);

        Matcher id = Pattern.compile("-(\\d+)$").matcher(pageUrl);
        String sourceId = id.find() ? id.group(1) : pageUrl.substring(pageUrl.lastIndexOf('/') + 1);

        return new RawConcertData(
                SOURCE,
                sourceId,
                artistFromTitle(name, city, venueName),
                name,
                startsAt,
                venueName,
                address,
                city,
                null,
                null,
                pageUrl,
                og.get("image"),
                false);
    }

    private static final Pattern EDITOR = Pattern.compile("<div id=\"editor\">(.*?)</div>", Pattern.DOTALL);

    /** Etkinlik açıklamasının düz metni (yoksa null). */
    static String descriptionText(String html) {
        Matcher m = EDITOR.matcher(html);
        if (!m.find()) return null;
        return NameCase.decodeEntities(m.group(1).replaceAll("<[^>]+>", " ")).replaceAll("\\s+", " ").trim();
    }

    /** "Ekim 28, 2026 22:00" → 2026-10-28T22:00 */
    static LocalDateTime parseDate(String text) {
        Matcher m = DATE_TEXT.matcher(text.trim());
        if (!m.find()) return null;
        Integer month = MONTHS.get(m.group(1).toLowerCase(TR));
        if (month == null) return null;
        try {
            return LocalDateTime.of(Integer.parseInt(m.group(3)), month, Integer.parseInt(m.group(2)),
                    Integer.parseInt(m.group(4)), Integer.parseInt(m.group(5)));
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** "Sinanpaşa … No: 11 - Beşiktaş / İstanbul" → "İstanbul" */
    static String cityFromAddress(String address) {
        if (address == null) return null;
        int slash = address.lastIndexOf('/');
        String city = (slash >= 0 ? address.substring(slash + 1) : address).trim();
        return city.isEmpty() ? null : JsonLd.normalizeCity(city);
    }

    private static final Pattern DATE_SUFFIX = Pattern.compile("\\s*\\d{1,2}[./]\\d{1,2}[./]\\d{2,4}\\s*$");
    private static final Pattern SEPARATOR = Pattern.compile("\\s+(?:[-–|]|@)\\s+");

    /**
     * Başlıktan sanatçı. Başlıklar sık sık mekân, şehir ve tarih taşıyor:
     *   "Bahadır Macit İstanbul Konseri"           → "Bahadır Macit"
     *   "Waidmann @ Rocknrolla Kadıköy Live 10.10" → "Waidmann"
     *   "Melankoli Konseri | Haymatlos Mekan"       → "Melankoli"
     *   "Mansur Ark & Dj Fikret Kocamaz - İstanbul" → "Mansur Ark & Dj Fikret Kocamaz"
     * Ayraçtan sonrası yalnız şehir, mekân ya da tarih ise atılır ("@" sonrası her zaman
     * mekândır). Eşleştirme (aynı konser başka sitede) sanatçı adına baktığı için önemli.
     */
    static String artistFromTitle(String title, String city, String venue) {
        String result = title;
        int at = result.indexOf(" @ ");
        if (at > 0) result = result.substring(0, at);
        // Sondan başa: yer/tarih olan son parça atılır, tekrarlanır ("X – Nu Metal Night | Ankara")
        boolean cut = true;
        while (cut) {
            cut = false;
            int lastStart = -1, lastEnd = -1;
            Matcher sep = SEPARATOR.matcher(result);
            while (sep.find()) { lastStart = sep.start(); lastEnd = sep.end(); }
            if (lastStart > 0 && isPlaceOrDate(result.substring(lastEnd), city, venue)) {
                result = result.substring(0, lastStart);
                cut = true;
            }
        }
        result = DATE_SUFFIX.matcher(result).replaceFirst("");
        result = result.replaceFirst("(?iu)\\s+konser(i|leri)?$", "");
        if (city != null && foldEq(lastWords(result, city), city)) {
            result = result.substring(0, result.length() - city.length()).trim();
        }
        result = result.trim();
        return result.isEmpty() ? title : result;
    }

    static String artistFromTitle(String title, String city) {
        return artistFromTitle(title, city, null);
    }

    private static boolean isPlaceOrDate(String tail, String city, String venue) {
        String t = tail.trim();
        if (DATE_SUFFIX.matcher(" " + t).matches()) return true;
        if (city != null && foldEq(t, city)) return true;
        if (venue != null) {
            String fv = NameCase.fold(venue), ft = NameCase.fold(t);
            if (fv.contains(ft) || ft.contains(fv)) return true;
        }
        return false;
    }

    private static String lastWords(String text, String like) {
        return text.length() >= like.length() ? text.substring(text.length() - like.length()) : "";
    }

    private static boolean foldEq(String a, String b) {
        return NameCase.fold(a.trim()).equals(NameCase.fold(b.trim()));
    }

    private static String clean(String value) {
        if (value == null) return null;
        String v = NameCase.decodeEntities(value).replaceAll("\\s+", " ").trim();
        return v.isEmpty() ? null : v;
    }
}
