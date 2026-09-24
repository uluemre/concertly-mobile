package com.concertly.backend.service;

import com.concertly.backend.config.ExternalHttp;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Konser saatindeki hava tahmini — Open-Meteo (anahtarsız, ücretsiz).
 *
 * Tahmin ufku 16 gündür; daha uzak konserler ve koordinatı olmayan mekânlar
 * için null döner. Sonuçlar bir saat önbelleklenir: aynı konsere bakan
 * herkes için tek istek gider.
 */
@Service
public class WeatherService {

    static final int FORECAST_DAYS = 16;
    private static final long CACHE_MS = 60 * 60 * 1000L;
    private static final ZoneId ZONE = ZoneId.of("Europe/Istanbul");

    private final RestTemplate restTemplate = ExternalHttp.restTemplate();
    private final Map<String, Cached> cache = new ConcurrentHashMap<>();

    private record Cached(Forecast value, long at) {}

    /** Konserin başladığı saatteki tahmin. */
    public record Forecast(
            LocalDate date,
            int hour,
            double temperature,
            double apparentTemperature,
            int precipitationProbability,
            int weatherCode,
            double windKmh) {}

    public Forecast forecastAt(Double latitude, Double longitude, LocalDateTime when) {
        if (latitude == null || longitude == null || when == null) return null;
        LocalDate today = LocalDate.now(ZONE);
        long daysAhead = ChronoUnit.DAYS.between(today, when.toLocalDate());
        if (daysAhead < 0 || daysAhead >= FORECAST_DAYS) return null;

        String key = String.format(Locale.ROOT, "%.3f,%.3f,%s,%d",
                latitude, longitude, when.toLocalDate(), when.getHour());
        Cached hit = cache.get(key);
        if (hit != null && System.currentTimeMillis() - hit.at() < CACHE_MS) return hit.value();

        Forecast forecast = fetch(latitude, longitude, when);
        if (forecast != null) {
            if (cache.size() > 500) cache.clear();
            cache.put(key, new Cached(forecast, System.currentTimeMillis()));
        }
        return forecast;
    }

    @SuppressWarnings("unchecked")
    private Forecast fetch(double latitude, double longitude, LocalDateTime when) {
        try {
            String day = when.toLocalDate().toString();
            String url = UriComponentsBuilder.fromUriString("https://api.open-meteo.com/v1/forecast")
                    .queryParam("latitude", String.format(Locale.ROOT, "%.4f", latitude))
                    .queryParam("longitude", String.format(Locale.ROOT, "%.4f", longitude))
                    .queryParam("hourly", "temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m")
                    .queryParam("timezone", ZONE.getId())
                    .queryParam("start_date", day)
                    .queryParam("end_date", day)
                    .toUriString();
            Map<String, Object> body = restTemplate.getForObject(url, Map.class);
            if (body == null) return null;
            Map<String, Object> hourly = (Map<String, Object>) body.get("hourly");
            if (hourly == null) return null;

            List<String> times = (List<String>) hourly.get("time");
            if (times == null || times.isEmpty()) return null;
            int hour = Math.min(when.getHour(), times.size() - 1);

            return new Forecast(
                    when.toLocalDate(),
                    hour,
                    num(hourly, "temperature_2m", hour),
                    num(hourly, "apparent_temperature", hour),
                    (int) Math.round(num(hourly, "precipitation_probability", hour)),
                    (int) Math.round(num(hourly, "weather_code", hour)),
                    num(hourly, "wind_speed_10m", hour));
        } catch (Exception e) {
            System.out.println("  ⚠️ Hava durumu alınamadı: " + e.getMessage());
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private static double num(Map<String, Object> hourly, String field, int index) {
        List<Object> values = (List<Object>) hourly.get(field);
        if (values == null || index >= values.size() || values.get(index) == null) return 0;
        return ((Number) values.get(index)).doubleValue();
    }
}
