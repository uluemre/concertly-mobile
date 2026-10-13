package com.concertly.backend.service;

import com.concertly.backend.model.AppSetting;
import com.concertly.backend.repository.AppSettingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Admin panelinden değiştirilen uygulama ayarları: bakım modu, duyuru bandı, özellik
 * anahtarları ve yeni hesap limitleri.
 *
 * Her ayarın türü, sınırları ve varsayılanı burada tanımlıdır; app_settings tablosunda
 * yalnız admin'in değiştirdikleri durur. Değerler bellekte tutulur (her istekte okunur,
 * DB'ye gidilmez) ve kayıttan sonra yenilenir. Tablo yoksa (V22 uygulanmamış) uygulama
 * varsayılanlarla çalışır, yalnız kaydetme hata verir.
 */
@Service
public class AppSettingsService {

    private static final Logger log = LoggerFactory.getLogger(AppSettingsService.class);

    public static final String MAINTENANCE = "maintenance.enabled";
    public static final String MAINTENANCE_MSG_TR = "maintenance.message_tr";
    public static final String MAINTENANCE_MSG_EN = "maintenance.message_en";
    public static final String ANNOUNCEMENT = "announcement.enabled";
    public static final String ANNOUNCEMENT_TR = "announcement.text_tr";
    public static final String ANNOUNCEMENT_EN = "announcement.text_en";
    public static final String ANNOUNCEMENT_TONE = "announcement.tone";
    public static final String ANNOUNCEMENT_LINK = "announcement.link";
    /** Duyuru metni ya da bağlantısı değişince artar: kapatılan bant yeni duyuruda yeniden görünür. */
    public static final String ANNOUNCEMENT_VERSION = "announcement.version";
    public static final String FEATURE_BUDDY = "feature.buddy";
    public static final String FEATURE_GAMES = "feature.games";
    public static final String FEATURE_COMMUNITIES = "feature.communities";
    public static final String FEATURE_POSTING = "feature.posting";
    public static final String FEATURE_EVENT_SUGGESTIONS = "feature.event_suggestions";
    public static final String FEATURE_REGISTRATION = "feature.registration";
    public static final String NEW_ACCOUNT_HOURS = "limits.new_account_hours";
    public static final String NEW_ACCOUNT_MAX_POSTS = "limits.new_account_max_posts";
    public static final String NEW_ACCOUNT_MAX_COMMENTS = "limits.new_account_max_comments";
    public static final String NEW_ACCOUNT_MAX_MESSAGES = "limits.new_account_max_messages";
    public static final String UPLOADS_PER_DAY = "limits.uploads_per_day";
    public static final String NEW_ACCOUNT_UPLOADS_PER_DAY = "limits.new_account_uploads_per_day";

    public static final List<String> TONES = List.of("info", "warning", "success");

    public enum Type { BOOLEAN, INT, TEXT, TONE, LINK }

    /** Bir ayarın tanımı: grup admin ekranındaki bölümdür. */
    public record Def(String key, String group, Type type, String defaultValue, long min, long max, boolean editable) {}

    public record AdminSetting(String key, String group, String type, String value, String defaultValue,
                               Long min, Long max, LocalDateTime updatedAt, String updatedBy) {}

    private final AppSettingRepository repository;
    private final Map<String, Def> defs = new LinkedHashMap<>();
    private volatile Map<String, String> values = Map.of();
    private volatile Map<String, AppSetting> rows = Map.of();

    public AppSettingsService(AppSettingRepository repository,
                              @Value("${app.moderation.new-account-hours:48}") long newAccountHours,
                              @Value("${app.moderation.new-account-max-posts-per-day:10}") long maxPosts,
                              @Value("${app.moderation.new-account-max-comments-per-day:50}") long maxComments,
                              @Value("${app.moderation.new-account-max-messages-per-day:50}") long maxMessages,
                              @Value("${app.media.max-uploads-per-day:30}") long uploadsPerDay,
                              @Value("${app.media.new-account-max-uploads-per-day:10}") long newAccountUploads) {
        this.repository = repository;
        def(MAINTENANCE, "maintenance", Type.BOOLEAN, "false", 0, 0);
        def(MAINTENANCE_MSG_TR, "maintenance", Type.TEXT, "", 0, 300);
        def(MAINTENANCE_MSG_EN, "maintenance", Type.TEXT, "", 0, 300);
        def(ANNOUNCEMENT, "announcement", Type.BOOLEAN, "false", 0, 0);
        def(ANNOUNCEMENT_TR, "announcement", Type.TEXT, "", 0, 300);
        def(ANNOUNCEMENT_EN, "announcement", Type.TEXT, "", 0, 300);
        def(ANNOUNCEMENT_TONE, "announcement", Type.TONE, "info", 0, 0);
        def(ANNOUNCEMENT_LINK, "announcement", Type.LINK, "", 0, 300);
        defs.put(ANNOUNCEMENT_VERSION, new Def(ANNOUNCEMENT_VERSION, "announcement", Type.INT, "0", 0, Long.MAX_VALUE, false));
        def(FEATURE_BUDDY, "features", Type.BOOLEAN, "true", 0, 0);
        def(FEATURE_GAMES, "features", Type.BOOLEAN, "true", 0, 0);
        def(FEATURE_COMMUNITIES, "features", Type.BOOLEAN, "true", 0, 0);
        def(FEATURE_POSTING, "features", Type.BOOLEAN, "true", 0, 0);
        def(FEATURE_EVENT_SUGGESTIONS, "features", Type.BOOLEAN, "true", 0, 0);
        def(FEATURE_REGISTRATION, "features", Type.BOOLEAN, "true", 0, 0);
        def(NEW_ACCOUNT_HOURS, "limits", Type.INT, String.valueOf(newAccountHours), 0, 720);
        def(NEW_ACCOUNT_MAX_POSTS, "limits", Type.INT, String.valueOf(maxPosts), 1, 1000);
        def(NEW_ACCOUNT_MAX_COMMENTS, "limits", Type.INT, String.valueOf(maxComments), 1, 5000);
        def(NEW_ACCOUNT_MAX_MESSAGES, "limits", Type.INT, String.valueOf(maxMessages), 1, 5000);
        def(UPLOADS_PER_DAY, "limits", Type.INT, String.valueOf(uploadsPerDay), 0, 1000);
        def(NEW_ACCOUNT_UPLOADS_PER_DAY, "limits", Type.INT, String.valueOf(newAccountUploads), 0, 1000);
    }

    private void def(String key, String group, Type type, String defaultValue, long min, long max) {
        defs.put(key, new Def(key, group, type, defaultValue, min, max, true));
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        try {
            reload();
        } catch (Exception e) {
            log.warn("Uygulama ayarlari okunamadi ({}); varsayilanlar kullaniliyor", e.getMessage());
        }
    }

    /** Kayıtlı değerleri belleğe alır. Tanımı olmayan eski anahtarlar yok sayılır. */
    public void reload() {
        Map<String, String> v = new HashMap<>();
        Map<String, AppSetting> r = new HashMap<>();
        for (AppSetting s : repository.findAll()) {
            if (!defs.containsKey(s.getKey())) continue;
            v.put(s.getKey(), s.getValue());
            r.put(s.getKey(), s);
        }
        values = Map.copyOf(v);
        rows = Map.copyOf(r);
    }

    // ── Okuma ─────────────────────────────────────────────────────────────────

    public String get(String key) {
        Def d = defs.get(key);
        if (d == null) throw new IllegalArgumentException("UNKNOWN_SETTING");
        String v = values.get(key);
        return v != null ? v : d.defaultValue();
    }

    public boolean isOn(String key) {
        return Boolean.parseBoolean(get(key));
    }

    /** Kayıtlı değer yoksa verilen yedek döner (servisler kendi ayar dosyası değerini verir). */
    public long getLong(String key, long fallback) {
        String v = values.get(key);
        if (v == null) return fallback;
        try {
            return Long.parseLong(v);
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    /** Uygulamanın açılışta okuduğu herkese açık özet (kimlik gerekmez). */
    public Map<String, Object> publicConfig() {
        Map<String, Object> features = new LinkedHashMap<>();
        features.put("buddy", isOn(FEATURE_BUDDY));
        features.put("games", isOn(FEATURE_GAMES));
        features.put("communities", isOn(FEATURE_COMMUNITIES));
        features.put("posting", isOn(FEATURE_POSTING));
        features.put("eventSuggestions", isOn(FEATURE_EVENT_SUGGESTIONS));
        features.put("registration", isOn(FEATURE_REGISTRATION));

        Map<String, Object> maintenance = new LinkedHashMap<>();
        maintenance.put("enabled", isOn(MAINTENANCE));
        maintenance.put("messageTr", get(MAINTENANCE_MSG_TR));
        maintenance.put("messageEn", get(MAINTENANCE_MSG_EN));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("features", features);
        out.put("maintenance", maintenance);
        boolean hasText = !get(ANNOUNCEMENT_TR).isBlank() || !get(ANNOUNCEMENT_EN).isBlank();
        if (isOn(ANNOUNCEMENT) && hasText) {
            Map<String, Object> a = new LinkedHashMap<>();
            a.put("version", getLong(ANNOUNCEMENT_VERSION, 0));
            a.put("textTr", get(ANNOUNCEMENT_TR));
            a.put("textEn", get(ANNOUNCEMENT_EN));
            a.put("tone", get(ANNOUNCEMENT_TONE));
            String link = get(ANNOUNCEMENT_LINK);
            a.put("link", link.isBlank() ? null : link);
            out.put("announcement", a);
        } else {
            out.put("announcement", null);
        }
        return out;
    }

    public List<AdminSetting> adminList() {
        List<AdminSetting> out = new ArrayList<>();
        for (Def d : defs.values()) {
            if (!d.editable()) continue;
            AppSetting row = rows.get(d.key());
            boolean numeric = d.type() == Type.INT;
            out.add(new AdminSetting(d.key(), d.group(), d.type().name(), get(d.key()), d.defaultValue(),
                    numeric ? d.min() : null, numeric ? d.max() : null,
                    row != null ? row.getUpdatedAt() : null, row != null ? row.getUpdatedBy() : null));
        }
        return out;
    }

    // ── Yazma ─────────────────────────────────────────────────────────────────

    /**
     * Değişiklikleri doğrular ve kaydeder. Hepsi geçerli değilse hiçbiri yazılmaz.
     * Dönen liste "anahtar: eski → yeni" satırlarıdır (işlem kaydı için).
     */
    @Transactional
    public List<String> update(Map<String, Object> changes, String adminName) {
        if (changes == null || changes.isEmpty()) return List.of();
        Map<String, String> normalized = new LinkedHashMap<>();
        for (Map.Entry<String, Object> e : changes.entrySet()) {
            Def d = defs.get(e.getKey());
            if (d == null || !d.editable()) throw new IllegalArgumentException("UNKNOWN_SETTING");
            normalized.put(d.key(), normalize(d, e.getValue()));
        }

        List<String> diff = new ArrayList<>();
        boolean announcementChanged = false;
        LocalDateTime now = LocalDateTime.now();
        for (Map.Entry<String, String> e : normalized.entrySet()) {
            String old = get(e.getKey());
            if (Objects.equals(old, e.getValue())) continue;
            save(e.getKey(), e.getValue(), adminName, now);
            diff.add(e.getKey() + ": " + abbreviate(old) + " → " + abbreviate(e.getValue()));
            if (e.getKey().startsWith("announcement.") && !e.getKey().equals(ANNOUNCEMENT)) {
                announcementChanged = true;
            }
            if (e.getKey().equals(ANNOUNCEMENT) && "true".equals(e.getValue())) {
                announcementChanged = true; // yeniden açılan duyuru, kapatmış olanlara da görünsün
            }
        }
        if (announcementChanged) {
            save(ANNOUNCEMENT_VERSION, String.valueOf(getLong(ANNOUNCEMENT_VERSION, 0) + 1), adminName, now);
        }
        if (!diff.isEmpty()) reload();
        return diff;
    }

    private void save(String key, String value, String adminName, LocalDateTime now) {
        AppSetting s = repository.findById(key).orElseGet(() -> {
            AppSetting n = new AppSetting();
            n.setKey(key);
            return n;
        });
        s.setValue(value);
        s.setUpdatedAt(now);
        s.setUpdatedBy(adminName);
        repository.save(s);
    }

    static String normalize(Def d, Object raw) {
        String s = raw == null ? "" : String.valueOf(raw).trim();
        switch (d.type()) {
            case BOOLEAN -> {
                if (!s.equals("true") && !s.equals("false")) throw new IllegalArgumentException("INVALID_SETTING_VALUE");
                return s;
            }
            case INT -> {
                long n;
                try {
                    n = Long.parseLong(s);
                } catch (NumberFormatException e) {
                    throw new IllegalArgumentException("INVALID_SETTING_VALUE");
                }
                if (n < d.min() || n > d.max()) throw new IllegalArgumentException("SETTING_OUT_OF_RANGE");
                return String.valueOf(n);
            }
            case TONE -> {
                if (!TONES.contains(s)) throw new IllegalArgumentException("INVALID_SETTING_VALUE");
                return s;
            }
            case LINK -> {
                if (s.length() > d.max()) throw new IllegalArgumentException("SETTING_TOO_LONG");
                // Yalnız uygulama içi bağlantı ya da https: javascript:/http: gibi şemalar reddedilir
                if (!s.isEmpty() && !s.startsWith("https://") && !s.startsWith("concertly://")) {
                    throw new IllegalArgumentException("INVALID_LINK");
                }
                return s;
            }
            default -> {
                if (s.length() > d.max()) throw new IllegalArgumentException("SETTING_TOO_LONG");
                return s;
            }
        }
    }

    private static String abbreviate(String v) {
        if (v == null || v.isEmpty()) return "∅";
        return v.length() > 60 ? v.substring(0, 57) + "…" : v;
    }
}
