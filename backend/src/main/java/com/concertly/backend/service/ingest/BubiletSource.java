package com.concertly.backend.service.ingest;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.concertly.backend.service.ingest.BiletinialSource.jsonLdBlocks;
import static com.concertly.backend.service.ingest.BiletinialSource.normalizeCity;
import static com.concertly.backend.service.ingest.BiletinialSource.text;
import static com.concertly.backend.service.ingest.BiletinialSource.toDouble;
import static com.concertly.backend.service.ingest.BiletinialSource.toLocalDateTime;

/**
 * Bubilet konser verisi okuyucusu.
 *
 * Biletinial ile ayni yaklasim: veri HTML yapisindan degil, her etkinlik
 * sayfasina gomulu schema.org JSON-LD blogundan okunur. Fark: Bubilet seanslari
 * ust Event'in subEvent dizisinde verir; her seans ayri konser kaydidir.
 *
 * Kesif sehrin konser etiketi sayfasindan yapilir (/{sehir}/etiket/konser).
 * Sayfa ilk yuklemede yalnizca one cikan ~25 konseri tasir; geri kalani
 * tarayicida yuklenir ve bilerek takip edilmez (ic API'ye baglanmiyoruz).
 *
 * Nezaket kurallari Biletinial'daki gibi: kendini tanitan User-Agent, istekler
 * arasi bekleme, yalnizca robots.txt'nin izin verdigi liste ve etkinlik
 * sayfalari. Bilet linki kaynaga geri verilir.
 */
@Service
public class BubiletSource {

    public static final String SOURCE = "BUBILET";

    private static final Logger log = LoggerFactory.getLogger(BubiletSource.class);

    private static final String BASE_URL = "https://www.bubilet.com.tr";
    private static final String CITY_LISTING = BASE_URL + "/%s/etiket/konser";

    /** Seans teklif adresindeki kimlik: .../seans/245435 */
    private static final Pattern SESSION_ID = Pattern.compile("/seans/(\\d+)");

    /** Sanatci adi yerine yazilan yer tutucular (kucuk harf). */
    private static final Set<String> PLACEHOLDER_PERFORMERS = Set.of("sanatçı", "sanatci", "artist", "performer");

    private final RestTemplate restTemplate;
    private final long politeDelayMs;
    private final int maxRetries;

    public BubiletSource(RestTemplateBuilder builder,
            @Value("${app.sources.bubilet.user-agent:ConcertlyBot/0.1 (+https://concertly-api.onrender.com/promo/)}") String userAgent,
            @Value("${app.sources.bubilet.delay-ms:800}") long politeDelayMs,
            @Value("${app.sources.bubilet.max-retries:2}") int maxRetries) {
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
     * @param citySlug bubilet sehir yolu, ornegin ankara
     * @param maxEvents kac etkinlik sayfasi acilacak
     */
    public List<RawConcertData> fetchCity(String citySlug, int maxEvents) {
        List<String> urls = listEventUrls(citySlug);
        log.info("Bubilet {}: {} etkinlik linki bulundu", citySlug, urls.size());

        List<RawConcertData> results = new ArrayList<>();
        int opened = 0;
        for (String url : urls) {
            if (opened >= maxEvents) break;
            opened++;
            String html = get(url);
            if (html == null) continue;
            results.addAll(parseEvents(html, url));
            pause(politeDelayMs);
        }
        return results;
    }

    /** Konser etiketi sayfasindaki etkinlik linklerini cikarir. */
    public List<String> listEventUrls(String citySlug) {
        String html = get(String.format(CITY_LISTING, citySlug));
        if (html == null) return List.of();
        return extractEventUrls(html, citySlug);
    }

    /** Sayfadaki /{sehir}/etkinlik/{slug} linkleri, gorulme sirasiyla ve tekil. */
    static List<String> extractEventUrls(String html, String citySlug) {
        Pattern link = Pattern.compile("href=\"(/" + Pattern.quote(citySlug) + "/etkinlik/[a-z0-9-]+)\"");
        Set<String> urls = new LinkedHashSet<>();
        Matcher matcher = link.matcher(html);
        while (matcher.find()) urls.add(BASE_URL + matcher.group(1));
        return new ArrayList<>(urls);
    }

    /**
     * Etkinlik sayfasindaki JSON-LD Event blogunu ham kayitlara cevirir.
     * Her seans (subEvent) ayri kayittir; seans yoksa ust Event kullanilir.
     */
    public List<RawConcertData> parseEvents(String html, String pageUrl) {
        List<RawConcertData> out = new ArrayList<>();
        for (JsonNode node : jsonLdBlocks(html)) {
            for (JsonNode event : node.isArray() ? node : List.of(node)) {
                if (!"Event".equalsIgnoreCase(event.path("@type").asText(""))) continue;
                JsonNode sessions = event.path("subEvent");
                List<JsonNode> list = new ArrayList<>();
                if (sessions.isArray() && !sessions.isEmpty()) sessions.forEach(list::add);
                else list.add(event);
                // Ayni saatte birden fazla seans olabiliyor (ayri bilet turleri);
                // konser olarak tek kayittir, ilk seans tutulur.
                // Iptal edilen seans, ayni saatteki gecerli seansi golgelemesin: once gecerliler.
                Set<LocalDateTime> seen = new HashSet<>();
                List<RawConcertData> cancelled = new ArrayList<>();
                for (JsonNode session : list) {
                    RawConcertData raw = toRaw(session, event, pageUrl);
                    if (raw == null || !raw.isUsable()) continue;
                    if (raw.cancelled()) cancelled.add(raw);
                    else if (seen.add(raw.startsAt())) out.add(raw);
                }
                for (RawConcertData raw : cancelled) {
                    if (seen.add(raw.startsAt())) out.add(raw);
                }
            }
        }
        return out;
    }

    private RawConcertData toRaw(JsonNode session, JsonNode parent, String pageUrl) {
        // Ertelenmis seans (yeni tarih yok) listelenmez. Iptal edilen seans ise iptal
        // bayragiyla doner: daha once alinmis kaydi iptal olarak isaretlemek icin.
        String status = session.path("eventStatus").asText("");
        if (status.endsWith("EventPostponed")) return null;
        boolean cancelled = status.endsWith("EventCancelled");

        LocalDateTime startsAt = toLocalDateTime(session.path("startDate").asText(null));
        if (startsAt == null) return null;

        JsonNode location = session.has("location") ? session.path("location") : parent.path("location");
        JsonNode address = location.path("address");
        JsonNode geo = location.path("geo");

        String concertName = text(session.path("name"));
        if (concertName == null) concertName = text(parent.path("name"));
        String artistName = singlePerformer(session.has("performer") ? session.path("performer") : parent.path("performer"));
        if (artistName == null) artistName = concertName;

        String image = first(session.has("image") ? session.path("image") : parent.path("image"));

        return new RawConcertData(
                SOURCE,
                buildSourceEventId(pageUrl, session, startsAt),
                artistName,
                concertName,
                startsAt,
                text(location.path("name")),
                text(address.path("streetAddress")),
                normalizeCity(text(address.path("addressLocality"))),
                toDouble(geo.path("latitude")),
                toDouble(geo.path("longitude")),
                pageUrl,
                image,
                cancelled);
    }

    /**
     * Kimlik: slug + seans numarasi. Seans numarasi tarih degisse de sabit
     * kaldigi icin ertelenen konser yeni satir acmaz; yoksa seans tarihine duser.
     */
    static String buildSourceEventId(String pageUrl, JsonNode session, LocalDateTime startsAt) {
        String slug = pageUrl.substring(pageUrl.lastIndexOf('/') + 1);
        String offerUrl = text(session.path("offers").path("url"));
        Matcher matcher = offerUrl == null ? null : SESSION_ID.matcher(offerUrl);
        if (matcher != null && matcher.find()) return slug + "@seans" + matcher.group(1);
        return slug + "@" + startsAt;
    }

    /**
     * performer tek nesne ya da dizi olabilir. Birden fazla sanatci festival /
     * karma etkinliktir; listenin ilkine baglamak yanlis olur (Wonder Village
     * Hadise'nin konseri gibi gorunuyordu), null donup etkinlik adina duseriz.
     */
    static String singlePerformer(JsonNode performer) {
        if (performer.isArray() && performer.size() != 1) return null;
        JsonNode node = performer.isArray() ? performer.path(0) : performer;
        String name = text(node.path("name"));
        // Bazi sayfalarda sanatci yerine yer tutucu yaziliyor ("Sanatçı").
        if (name != null && PLACEHOLDER_PERFORMERS.contains(name.toLowerCase(Locale.forLanguageTag("tr")))) return null;
        return name;
    }

    /** Metin ya da metin dizisi; ilk degeri dondurur. */
    private static String first(JsonNode node) {
        return text(node.isArray() ? node.path(0) : node);
    }

    /** Sayfayi ceker; gecici hatalarda artan beklemeyle sinirli sayida yeniden dener. */
    private String get(String url) {
        Exception last = null;
        for (int attempt = 0; attempt <= maxRetries; attempt++) {
            if (attempt > 0) pause(politeDelayMs + attempt * 1000L);
            try {
                return restTemplate.exchange(url, HttpMethod.GET,
                        new HttpEntity<>(new HttpHeaders()), String.class).getBody();
            } catch (Exception e) {
                last = e;
            }
        }
        log.warn("Bubilet istegi {} denemede basarisiz ({}): {}",
                maxRetries + 1, url, last != null ? last.getMessage() : "bilinmiyor");
        return null;
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
