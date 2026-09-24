package com.concertly.backend.config;

import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

/**
 * Dış servis (Ticketmaster, Spotify, Deezer, Brevo, Expo push, Open-Meteo)
 * çağrıları için zaman aşımlı RestTemplate.
 *
 * {@code new RestTemplate()} süresiz bekler: karşı taraf yanıt vermezse istek
 * iş parçacığını sonsuza kadar tutar ve küçük sunucuyu kilitleyebilir.
 * Biletinial kaynağındaki yaklaşımla aynı sınırlar kullanılır.
 */
public final class ExternalHttp {

    public static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);
    public static final Duration READ_TIMEOUT = Duration.ofSeconds(10);

    private ExternalHttp() {}

    public static RestTemplate restTemplate() {
        return restTemplate(CONNECT_TIMEOUT, READ_TIMEOUT);
    }

    public static RestTemplate restTemplate(Duration connectTimeout, Duration readTimeout) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeout);
        factory.setReadTimeout(readTimeout);
        return new RestTemplate(factory);
    }
}
