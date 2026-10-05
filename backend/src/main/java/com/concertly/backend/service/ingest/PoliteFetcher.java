package com.concertly.backend.service.ingest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

/**
 * Bilet sitelerinden sayfa çeken ortak, "nazik" istemci.
 *
 * Kurallar her kaynakta aynı: kendini tanıtan User-Agent, istekler arası bekleme,
 * geçici hatalarda artan beklemeyle sınırlı yeniden deneme. Bot doğrulaması
 * (Cloudflare challenge vb.) olan sayfalar AŞILMAYA çalışılmaz; hata olarak döner.
 */
public class PoliteFetcher {

    public static final String DEFAULT_USER_AGENT = "ConcertlyBot/0.1 (+https://concertly-api.onrender.com/promo/)";

    private static final Logger log = LoggerFactory.getLogger(PoliteFetcher.class);

    private final String sourceLabel;
    private final RestTemplate restTemplate;
    private final long politeDelayMs;
    private final int maxRetries;

    public PoliteFetcher(String sourceLabel, RestTemplateBuilder builder, String userAgent,
                         long politeDelayMs, int maxRetries) {
        this.sourceLabel = sourceLabel;
        this.politeDelayMs = politeDelayMs;
        this.maxRetries = maxRetries;
        this.restTemplate = builder
                .connectTimeout(Duration.ofSeconds(10))
                .readTimeout(Duration.ofSeconds(20))
                .defaultHeader(HttpHeaders.USER_AGENT, userAgent == null || userAgent.isBlank() ? DEFAULT_USER_AGENT : userAgent)
                .defaultHeader(HttpHeaders.ACCEPT_LANGUAGE, "tr-TR,tr;q=0.9")
                .build();
    }

    /** Sayfayı çeker; başarısızsa null (çağıran o sayfayı atlar). */
    public String get(String url) {
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
        log.warn("{} istegi {} denemede basarisiz ({}): {}", sourceLabel,
                maxRetries + 1, url, last != null ? last.getMessage() : "bilinmiyor");
        return null;
    }

    /** İki sayfa arası nezaket beklemesi. */
    public void politePause() {
        pause(politeDelayMs);
    }

    private static void pause(long millis) {
        if (millis <= 0) return;
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
