package com.concertly.backend.service.ingest;

import com.fasterxml.jackson.core.json.JsonReadFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Bilet sitelerindeki schema.org JSON-LD verisini okuyan ortak yardımcılar.
 *
 * Tüm sayfa okuyucuları (Biletinial, Bubilet, Biletino, Zorlu PSM …) bunu kullanır;
 * böylece tarih/şehir/metin kuralları tek yerde kalır.
 *
 * Toleranslı okuma: sitelerin elle yazdığı JSON-LD sık sık küçük biçim hataları
 * taşıyor (Zorlu PSM'de dizinin sonunda fazladan virgül). Katı okuyucu bu bloğu
 * tamamen atardı; burada yorum, sondaki virgül, tek tırnak ve kaçışsız satır
 * sonu kabul edilir.
 */
public final class JsonLd {

    private static final Logger log = LoggerFactory.getLogger(JsonLd.class);

    private static final Pattern LD_JSON = Pattern.compile(
            "<script[^>]*type=\"application/ld\\+json\"[^>]*>(.*?)</script>",
            Pattern.DOTALL | Pattern.CASE_INSENSITIVE);

    /** Etkinlik saatleri Türkiye duvar saatiyle saklanır. */
    private static final ZoneId ISTANBUL = ZoneId.of("Europe/Istanbul");

    /** schema.org'da konser sayılabilecek Event alt türleri. */
    private static final Set<String> EVENT_TYPES = Set.of(
            "event", "musicevent", "festival", "theaterevent", "socialevent", "entertainmentevent");

    private static final ObjectMapper LENIENT = JsonMapper.builder()
            .enable(JsonReadFeature.ALLOW_JAVA_COMMENTS)
            .enable(JsonReadFeature.ALLOW_TRAILING_COMMA)
            .enable(JsonReadFeature.ALLOW_SINGLE_QUOTES)
            .enable(JsonReadFeature.ALLOW_UNESCAPED_CONTROL_CHARS)
            .enable(JsonReadFeature.ALLOW_BACKSLASH_ESCAPING_ANY_CHARACTER)
            .build();

    private JsonLd() {}

    /** Sayfadaki JSON-LD blokları (okunamayan blok atlanır). */
    public static List<JsonNode> blocks(String html) {
        List<JsonNode> nodes = new ArrayList<>();
        if (html == null) return nodes;
        Matcher matcher = LD_JSON.matcher(html);
        while (matcher.find()) {
            String raw = matcher.group(1).trim();
            if (raw.isEmpty()) continue;
            try {
                nodes.add(LENIENT.readTree(raw));
            } catch (Exception e) {
                log.debug("JSON-LD blogu okunamadi: {}", e.getMessage());
            }
        }
        return nodes;
    }

    /**
     * Sayfadaki tüm Event düğümleri: dizi içinde, @graph içinde ya da tek başına
     * olabilir; türü Event ya da alt türü (MusicEvent, Festival …) olanlar döner.
     */
    public static List<JsonNode> events(String html) {
        List<JsonNode> out = new ArrayList<>();
        for (JsonNode block : blocks(html)) collectEvents(block, out);
        return out;
    }

    private static void collectEvents(JsonNode node, List<JsonNode> out) {
        if (node == null) return;
        if (node.isArray()) {
            node.forEach(n -> collectEvents(n, out));
            return;
        }
        if (!node.isObject()) return;
        if (isEvent(node)) out.add(node);
        if (node.has("@graph")) collectEvents(node.get("@graph"), out);
    }

    /** @type tek değer ya da dizi olabilir ("MusicEvent" / ["Event","MusicEvent"]). */
    public static boolean isEvent(JsonNode node) {
        JsonNode type = node.path("@type");
        if (type.isArray()) {
            for (JsonNode t : type) {
                if (EVENT_TYPES.contains(t.asText("").toLowerCase(Locale.ROOT))) return true;
            }
            return false;
        }
        return EVENT_TYPES.contains(type.asText("").toLowerCase(Locale.ROOT));
    }

    /** Boş olmayan metin; metin değilse JSON gösterimi; yoksa null. */
    public static String text(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) return null;
        String value = node.isTextual() ? node.asText() : node.toString();
        value = value.trim();
        return value.isEmpty() ? null : value;
    }

    /** Metin ya da metin dizisi; ilk değeri döndürür (image alanı ikisi de olabilir). */
    public static String first(JsonNode node) {
        if (node == null) return null;
        JsonNode value = node.isArray() ? node.path(0) : node;
        // image bazen {"@type":"ImageObject","url":"..."} biçiminde gelir
        if (value.isObject() && value.has("url")) return text(value.path("url"));
        return text(value);
    }

    public static Double toDouble(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) return null;
        try {
            return Double.valueOf(node.asText().trim().replace(',', '.'));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Saat dilimli tarihi Türkiye duvar saatine çevirir; dilimsiz tarih olduğu gibi alınır. */
    public static LocalDateTime toLocalDateTime(String isoDate) {
        if (isoDate == null || isoDate.isBlank()) return null;
        String value = isoDate.trim();
        try {
            return OffsetDateTime.parse(value).atZoneSameInstant(ISTANBUL).toLocalDateTime();
        } catch (DateTimeParseException ignored) {
            // Saat dilimi olmayan biçim de gelebilir.
        }
        try {
            return LocalDateTime.parse(value);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    /**
     * Kaynaklar şehri "Istanbul Anadolu" / "İstanbul Avrupa" gibi yaka bilgisiyle
     * verir; Concertly şehir bazında çalıştığı için yaka ekini atıyoruz.
     */
    public static String normalizeCity(String locality) {
        if (locality == null || locality.isBlank()) return null;
        String city = locality.trim();
        String lower = city.toLowerCase(Locale.ROOT);
        for (String suffix : new String[] { " anadolu", " avrupa", " asya" }) {
            if (lower.endsWith(suffix)) return city.substring(0, city.length() - suffix.length()).trim();
        }
        return city;
    }

    /** schema.org eventStatus iptal mi. */
    public static boolean isCancelled(JsonNode event) {
        return event.path("eventStatus").asText("").endsWith("EventCancelled");
    }

    /** schema.org eventStatus ertelenmiş mi (yeni tarih bilinmiyor). */
    public static boolean isPostponed(JsonNode event) {
        return event.path("eventStatus").asText("").endsWith("EventPostponed");
    }
}
