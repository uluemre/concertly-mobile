package com.concertly.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Paylaşılabilir link ayarları.
 *
 * Paylaşılan her şey (etkinlik, sanatçı, profil, gönderi, topluluk) önce bir
 * WEB adresine gider; o sayfa uygulamayı açmayı dener, yüklü değilse mağazaya
 * yönlendirir. Böylece link WhatsApp/Instagram'da önizleme de üretir.
 */
@Component
public class ShareLinkConfig {

    private final String baseUrl;
    private final String iosAppId;
    private final String androidPackage;
    private final String iosBundleId;
    private final String appScheme;

    public ShareLinkConfig(
            @Value("${app.share.base-url:https://concertly-api.onrender.com}") String baseUrl,
            @Value("${app.share.ios-app-id:}") String iosAppId,
            @Value("${app.share.android-package:com.concertly.app}") String androidPackage,
            @Value("${app.share.ios-bundle-id:com.concertly.app}") String iosBundleId,
            @Value("${app.share.app-scheme:concertly}") String appScheme) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        this.iosAppId = iosAppId;
        this.androidPackage = androidPackage;
        this.iosBundleId = iosBundleId;
        this.appScheme = appScheme;
    }

    public String getBaseUrl() { return baseUrl; }

    public String getIosAppId() { return iosAppId; }

    public String getAndroidPackage() { return androidPackage; }

    public String getIosBundleId() { return iosBundleId; }

    public String getAppScheme() { return appScheme; }

    /** App Store henüz yayında değilken mağaza yönlendirmesi tanıtım sayfasına düşer. */
    public String iosStoreUrl() {
        return iosAppId == null || iosAppId.isBlank()
                ? baseUrl + "/promo/"
                : "https://apps.apple.com/app/id" + iosAppId;
    }

    public String androidStoreUrl() {
        return "https://play.google.com/store/apps/details?id=" + androidPackage;
    }

    /** Göreli yüklenen görselleri mutlak adrese çevirir (og:image mutlak olmalı). */
    public String absoluteImage(String url) {
        if (url == null || url.isBlank()) return baseUrl + "/promo/og.png";
        if (url.startsWith("http://") || url.startsWith("https://")) return url;
        return baseUrl + (url.startsWith("/") ? url : "/" + url);
    }
}
