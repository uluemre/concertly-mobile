package com.concertly.backend.service.ingest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Biletinial konser verisi okuyucusu (prototip).
 *
 * Site her etkinlik sayfasina schema.org JSON-LD gomuyor; veriyi HTML
 * yapisindan degil O BLOKTAN okuyoruz. Yayinlanmis yapilandirilmis veri
 * oldugu icin sayfa tasarimi degistiginde kirilmaz.
 *
 * Kapsam disi tutulanlar (bilerek): veritabanina yazma, mukerrer kontrolu,
 * zamanlanmis calisma. Bu asamada yalnizca "veriyi cekebiliyor muyuz"
 * sorusunu yanitliyoruz.
 *
 * Nezaket kurallari: istekler arasinda bekleme, kendini tanitan User-Agent,
 * sadece liste ve etkinlik sayfalari. Aciklama metni ve gorsel dosyasi
 * kopyalanmaz; gorselden yalnizca adres tutulur, bilet linki kaynaga geri verilir.
 */
@Service
public class BiletinialSource {

    public static final String SOURCE = "BILETINIAL";

    private static final Logger log = LoggerFactory.getLogger(BiletinialSource.class);

    private static final String BASE_URL = "https://biletinial.com";
    private static final String CITY_LISTING = BASE_URL + "/tr-tr/muzik/%s";

    /** Sayfaya gomulu JSON-LD bloklari. */
    private static final Pattern LD_JSON = Pattern.compile(
            "<script[^>]*type=\"application/ld\\+json\"[^>]*>(.*?)</script>",
            Pattern.DOTALL | Pattern.CASE_INSENSITIVE);

    /** Etkinlik saatleri Turkiye duvar saatiyle saklanir. */
    private static final ZoneId ISTANBUL = ZoneId.of("Europe/Istanbul");

    private final ObjectMapper mapper = new ObjectMapper();
    private final RestTemplate restTemplate;
    private final long politeDelayMs;
    private final int maxRetries;

    public BiletinialSource(RestTemplateBuilder builder,
            @Value("${app.sources.biletinial.user-agent:ConcertlyBot/0.1 (+https://concertly-backend.onrender.com/promo/)}") String userAgent,
            @Value("${app.sources.biletinial.delay-ms:800}") long politeDelayMs,
            @Value("${app.sources.biletinial.max-retries:2}") int maxRetries) {
        this.politeDelayMs = politeDelayMs;
        this.maxRetries = maxRetries;
        this.restTemplate = builder
                .connectTimeout(Duration.ofSeconds(10))
                .readTimeout(Duration.ofSeconds(20))
                .defaultHeader(HttpHeaders.USER_AGENT, userAgent)
                .defaultHeader(HttpHeaders.ACCEPT_LANGUAGE, "tr-TR,tr;q=0.9")
                .build();
    }

    /**
     * Bir sehrin konser listesinden ham kayitlari toplar.
     *
     * @param citySlug biletinial sehir yolu, ornegin ankara
     * @param maxEvents kac etkinlik sayfasi acilacak (prototipte kucuk tut)
     */
    public List<RawConcertData> fetchCity(String citySlug, int maxEvents) {
        List<String> urls = listEventUrls(citySlug);
        log.info("Biletinial {}: {} etkinlik linki bulundu", citySlug, urls.size());

        List<RawConcertData> results = new ArrayList<>();
        int opened = 0;
        for (String url : urls) {
            if (opened >= maxEvents) break;
            opened++;
            String html = get(url);
            if (html == null) continue;
            List<RawConcertData> parsed = parseEvents(html, url);
            results.addAll(parsed);
            sleep();
        }
        return results;
    }

    /** Sehir listesindeki ItemList JSON-LD blogundan etkinlik adreslerini cikarir. */
    public List<String> listEventUrls(String citySlug) {
        String html = get(String.format(CITY_LISTING, citySlug));
        if (html == null) return List.of();

        Set<String> urls = new LinkedHashSet<>();
        for (JsonNode node : jsonLdBlocks(html)) {
            JsonNode items = node.path("itemListElement");
            if (!items.isArray()) continue;
            for (JsonNode item : items) {
                String url = item.path("url").asText(null);
                if (url != null && !url.isBlank()) urls.add(url);
            }
        }
        return new ArrayList<>(urls);
    }

    /**
     * Etkinlik sayfasindaki JSON-LD blogunu ham kayitlara cevirir.
     *
     * Turne sayfalari tek blokta Event DIZISI dondurur (her seans ayri tarih ve
     * mekan), bu yuzden dizi ve tekil nesne ayni sekilde ele alinir.
     */
    public List<RawConcertData> parseEvents(String html, String pageUrl) {
        List<RawConcertData> out = new ArrayList<>();
        for (JsonNode node : jsonLdBlocks(html)) {
            for (JsonNode event : node.isArray() ? node : List.of(node)) {
                if (!"Event".equalsIgnoreCase(event.path("@type").asText(""))) continue;
                RawConcertData raw = toRaw(event, pageUrl);
                if (raw != null && raw.isUsable()) out.add(raw);
            }
        }
        return out;
    }

    private RawConcertData toRaw(JsonNode event, String pageUrl) {
        LocalDateTime startsAt = toLocalDateTime(event.path("startDate").asText(null));
        if (startsAt == null) return null;

        JsonNode location = event.path("location");
        JsonNode address = location.path("address");
        JsonNode geo = location.path("geo");

        String ticketUrl = text(event.path("url"));
        if (ticketUrl == null) ticketUrl = pageUrl;

        // Sanatci alani her sayfada dolu degil; yoksa etkinlik adina duseriz
        // (Ticketmaster tarafinda da ayni geri donus kullaniliyor).
        String artistName = text(event.path("performer").path("name"));
        String concertName = text(event.path("name"));
        if (artistName == null) artistName = concertName;

        return new RawConcertData(
                SOURCE,
                buildSourceEventId(ticketUrl, startsAt),
                artistName,
                concertName,
                startsAt,
                text(location.path("name")),
                text(address.path("streetAddress")),
                normalizeCity(text(address.path("addressLocality"))),
                toDouble(geo.path("latitude")),
                toDouble(geo.path("longitude")),
                ticketUrl,
                text(event.path("image")));
    }

    /**
     * Ayni sayfadaki her seans ayri konserdir; kimlik slug ile seans tarihinin
     * birlesimidir. Boylece bir turnenin tarihleri birbirini ezmez.
     */
    private String buildSourceEventId(String ticketUrl, LocalDateTime startsAt) {
        String slug = ticketUrl;
        int lastSlash = slug.lastIndexOf('/');
        if (lastSlash >= 0 && lastSlash < slug.length() - 1) slug = slug.substring(lastSlash + 1);
        return slug + "@" + startsAt;
    }

    /**
     * Kaynak sehri "Istanbul Anadolu" / "Istanbul Avrupa" gibi yaka bilgisiyle
     * verir; Concertly sehir bazinda calistigi icin yaka ekini atiyoruz.
     */
    static String normalizeCity(String locality) {
        if (locality == null || locality.isBlank()) return null;
        String city = locality.trim();
        String lower = city.toLowerCase(Locale.ROOT);
        for (String suffix : new String[] { " anadolu", " avrupa", " asya" }) {
            if (lower.endsWith(suffix)) return city.substring(0, city.length() - suffix.length()).trim();
        }
        return city;
    }

    /** Saat dilimli tarihi Turkiye duvar saatine cevirir. */
    static LocalDateTime toLocalDateTime(String isoDate) {
        if (isoDate == null || isoDate.isBlank()) return null;
        try {
            return OffsetDateTime.parse(isoDate).atZoneSameInstant(ISTANBUL).toLocalDateTime();
        } catch (DateTimeParseException ignored) {
            // Saat dilimi olmayan bicim de gelebilir.
        }
        try {
            return LocalDateTime.parse(isoDate);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    // ── Yardimcilar ─────────────────────────────────────────────────────────

    private List<JsonNode> jsonLdBlocks(String html) {
        List<JsonNode> nodes = new ArrayList<>();
        Matcher matcher = LD_JSON.matcher(html);
        while (matcher.find()) {
            String raw = matcher.group(1).trim();
            if (raw.isEmpty()) continue;
            try {
                nodes.add(mapper.readTree(raw));
            } catch (Exception e) {
                log.debug("JSON-LD blogu okunamadi: {}", e.getMessage());
            }
        }
        return nodes;
    }

    /**
     * Sayfayi ceker. Gecici ag hatalarinda kontrollu sekilde yeniden dener:
     * deneme sayisi sinirli ve her denemeden once artan bir bekleme var, boylece
     * karsi tarafa yuk bindirmeden gecici kesintiler tolere edilir.
     */
    private String get(String url) {
        Exception last = null;
        for (int attempt = 0; attempt <= maxRetries; attempt++) {
            if (attempt > 0) {
                // Artan bekleme: 1. tekrar 1 sn, 2. tekrar 2 sn ...
                pause(politeDelayMs + attempt * 1000L);
                log.debug("Biletinial yeniden deneme {}/{}: {}", attempt, maxRetries, url);
            }
            try {
                ResponseEntity<String> response =
                        restTemplate.exchange(url, org.springframework.http.HttpMethod.GET,
                                new HttpEntity<>(new HttpHeaders()), String.class);
                return response.getBody();
            } catch (Exception e) {
                last = e;
            }
        }
        log.warn("Biletinial istegi {} denemede basarisiz ({}): {}",
                maxRetries + 1, url, last != null ? last.getMessage() : "bilinmiyor");
        return null;
    }

    private static String text(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) return null;
        String value = node.isTextual() ? node.asText() : node.toString();
        value = value.trim();
        return value.isEmpty() ? null : value;
    }

    private static Double toDouble(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) return null;
        try {
            return Double.valueOf(node.asText());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Istekler arasi nezaket beklemesi. */
    private void sleep() {
        pause(politeDelayMs);
    }

    private void pause(long millis) {
        if (millis <= 0) return;
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
