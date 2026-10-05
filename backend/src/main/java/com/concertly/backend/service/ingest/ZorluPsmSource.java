package com.concertly.backend.service.ingest;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Zorlu PSM mekân sitesinden konser okuyucu.
 *
 * Neden mekân sitesi: Zorlu PSM biletlerini Passo'da satıyor; Passo bot doğrulamasıyla
 * korunduğu için oradan okumuyoruz. Mekânın kendi sayfaları ise schema.org Event
 * verisi taşıyor ve bilet linki (Passo) bu veride var.
 *
 * Keşif: site haritası (etkinlik adresleri + gerçek lastmod). Yalnız yaklaşan etkinliğin
 * sayfasında JSON-LD var; geçmiş etkinlik sayfası boş döner. Konser olup olmadığı
 * sayfanın üst bilgi kutusundaki kategori etiketinden anlaşılır ("KONSER").
 */
@Service
public class ZorluPsmSource {

    public static final String SOURCE = "ZORLU_PSM";

    static final String BASE_URL = "https://www.zorlupsm.com";
    private static final String SITEMAP = BASE_URL + "/tr/sitemap.xml";

    /** Tüm etkinlikler aynı yerleşkede; JSON-LD yalnız salon adını veriyor. */
    static final String VENUE_NAME = "Zorlu PSM";
    static final String VENUE_ADDRESS = "Levazım, Koru Sokağı No:2, 34340 Beşiktaş/İstanbul";
    static final String CITY = "İstanbul";
    static final double LATITUDE = 41.0670;
    static final double LONGITUDE = 29.0170;

    private static final Pattern SITEMAP_ENTRY = Pattern.compile(
            "<loc>\\s*(" + Pattern.quote(BASE_URL) + "/etkinlikler/([a-z0-9-]+))\\s*</loc>\\s*(?:<lastmod>\\s*([^<\\s]+)\\s*</lastmod>)?");

    /** Üst bilgi kutusu: sayfanın kendi kategori etiketleri burada (menü ve öneri kartları değil). */
    private static final Pattern INFO_HEADER = Pattern.compile(
            "class=\"event-detail-info-item-header\"(.{0,1500}?)<h1", Pattern.DOTALL);
    private static final Pattern CATEGORY_LINK = Pattern.compile("href=\"(?:" + Pattern.quote(BASE_URL) + ")?/etkinlikler/([a-z0-9-]+)\"");

    /** Kategori sayfaları (etkinlik değil); haritada etkinliklerle aynı yolda duruyor. */
    static final Set<String> CATEGORY_SLUGS = Set.of(
            "konser", "tiyatro", "stand-up", "muzikal", "opera", "bale", "dans", "festival", "parti",
            "cocuk", "atolye", "sergi", "gosterim", "panel", "diger", "aile-eglencesi", "galeri-alani",
            "hediye-kart-kampanya", "mastercard", "meydan-fuaye", "psm-genc", "sky-lounge", "touche",
            "turkcell-platinum-sahnesi", "turkcell-sahnesi", "turkcell-sahnesi-sahne-ustu-ayakta",
            "vestel-amfi", "zorlu-psm", "zorlu-psm-uygulama-firsatlari", "100-studio");

    private final PoliteFetcher fetcher;

    public ZorluPsmSource(RestTemplateBuilder builder,
            @Value("${app.sources.zorlupsm.user-agent:" + PoliteFetcher.DEFAULT_USER_AGENT + "}") String userAgent,
            @Value("${app.sources.zorlupsm.delay-ms:1000}") long politeDelayMs,
            @Value("${app.sources.zorlupsm.max-retries:2}") int maxRetries) {
        this.fetcher = new PoliteFetcher("Zorlu PSM", builder, userAgent, politeDelayMs, maxRetries);
    }

    /** Haritadaki etkinlik adresleri, en son değişen önce (yeni konserler ilk gece bulunur). */
    public List<String> sitemapEventUrls() {
        String xml = fetcher.get(SITEMAP);
        return xml == null ? List.of() : extractSitemapEventUrls(xml);
    }

    static List<String> extractSitemapEventUrls(String xml) {
        Map<String, String> byUrl = new LinkedHashMap<>();
        Matcher m = SITEMAP_ENTRY.matcher(xml);
        while (m.find()) {
            if (CATEGORY_SLUGS.contains(m.group(2))) continue;
            byUrl.putIfAbsent(m.group(1), m.group(3) == null ? "" : m.group(3));
        }
        List<String> urls = new ArrayList<>(byUrl.keySet());
        urls.sort(Comparator.comparing((String u) -> byUrl.get(u)).reversed());
        return urls;
    }

    public SourcePageCrawler.PageResult fetchPage(String url) {
        String html = fetcher.get(url);
        fetcher.politePause();
        if (html == null) return SourcePageCrawler.PageResult.failed();
        List<RawConcertData> records = parseEvents(html, url);
        boolean music = isConcertPage(html) && !records.isEmpty();
        return SourcePageCrawler.PageResult.of(music, records);
    }

    /** Sayfanın kendi kategori etiketlerinde "konser" var mı. */
    static boolean isConcertPage(String html) {
        Matcher header = INFO_HEADER.matcher(html);
        if (!header.find()) return false;
        Matcher link = CATEGORY_LINK.matcher(header.group(1));
        while (link.find()) {
            if ("konser".equals(link.group(1))) return true;
        }
        return false;
    }

    /** Sayfadaki Event blokları (her seans ayrı blok olabilir). */
    static List<RawConcertData> parseEvents(String html, String pageUrl) {
        List<RawConcertData> out = new ArrayList<>();
        Set<LocalDateTime> seen = new HashSet<>();
        for (JsonNode event : JsonLd.events(html)) {
            if (JsonLd.isPostponed(event)) continue;
            LocalDateTime startsAt = JsonLd.toLocalDateTime(event.path("startDate").asText(null));
            if (startsAt == null || !seen.add(startsAt)) continue;
            String name = properName(JsonLd.text(event.path("name")), JsonLd.text(event.path("description")));
            if (name == null) continue;
            String ticket = ticketUrl(event, pageUrl);
            out.add(new RawConcertData(
                    SOURCE,
                    sourceEventId(pageUrl, ticket, startsAt),
                    name,            // sanatçı alanı yok; eşleştirme ad üzerinden yapılır
                    name,
                    startsAt,
                    VENUE_NAME,
                    VENUE_ADDRESS,
                    CITY,
                    LATITUDE,
                    LONGITUDE,
                    ticket,
                    JsonLd.first(event.path("image")),
                    JsonLd.isCancelled(event)));
        }
        return out;
    }

    private static final Pattern SESSION_PARAM = Pattern.compile("[?&]p=([0-9a-fA-F-]{8,})");

    /**
     * Kimlik: slug + seans kodu (teklif adresindeki ?p=). Seans kodu tarih değişse de
     * sabit kaldığı için ertelenen konser yeni satır açmaz; yoksa seans tarihine düşer.
     */
    static String sourceEventId(String pageUrl, String ticketUrl, LocalDateTime startsAt) {
        String slug = pageUrl.substring(pageUrl.lastIndexOf('/') + 1);
        Matcher m = ticketUrl == null ? null : SESSION_PARAM.matcher(ticketUrl);
        if (m != null && m.find()) return slug + "@p" + m.group(1);
        return slug + "@" + startsAt;
    }

    /** Teklifteki satın alma adresi (Zorlu sayfası + seans kodu; ödeme Passo'da); yoksa etkinlik sayfası. */
    static String ticketUrl(JsonNode event, String pageUrl) {
        JsonNode offers = event.path("offers");
        JsonNode first = offers.isArray() ? offers.path(0) : offers;
        String url = JsonLd.text(first.path("url"));
        return url != null && url.startsWith("http") ? url : pageUrl;
    }

    /** Büyük harfli adı düzeltir (bkz. NameCase). */
    static String properName(String rawName, String description) {
        return NameCase.properName(rawName, description);
    }

    static String clean(String name) {
        return NameCase.properName(name, null);
    }

    static String titleCaseTr(String value) {
        return NameCase.titleCase(value);
    }
}
