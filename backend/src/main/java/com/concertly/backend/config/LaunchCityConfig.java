package com.concertly.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

@Component
public class LaunchCityConfig {

    /** Ayar dosyasındaki liste: ilk kurulumda açılacak şehirler ve veritabanı yokken yedek. */
    private final List<String> cities;

    /**
     * Veritabanındaki açık şehirler (admin panelinden yönetilir). Boşsa ayar listesi
     * kullanılır. CityService açılışta ve her değişiklikte günceller.
     */
    private volatile List<String> active = List.of();

    public LaunchCityConfig(
            @Value("${app.launch.cities:İstanbul,Ankara,İzmir,Antalya}") String configuredCities) {
        this.cities = Arrays.stream(configuredCities.split(","))
                .map(String::trim)
                .filter(city -> !city.isBlank())
                .distinct()
                .toList();
        if (this.cities.isEmpty()) {
            throw new IllegalArgumentException("app.launch.cities en az bir şehir içermeli");
        }
    }

    public List<String> getCities() {
        List<String> current = active;
        return current.isEmpty() ? cities : current;
    }

    /** Ayar dosyasındaki ilk kurulum listesi. */
    public List<String> getConfiguredCities() {
        return cities;
    }

    /** CityService veritabanındaki açık şehirleri bildirir (boş liste = ayar listesine dön). */
    public void refresh(List<String> enabledCities) {
        this.active = enabledCities == null ? List.of() : List.copyOf(enabledCities);
    }

    /** Bilet sitelerinin şehir adresleri: "eskisehir". */
    public List<String> citySlugs() {
        return getCities().stream().map(TurkishProvinces::slug).toList();
    }

    /** BiletimGo takvim adresleri: "eskisehir-26" (plakası bilinmeyen şehir atlanır). */
    public List<String> slugPlateCodes() {
        return getCities().stream()
                .filter(c -> TurkishProvinces.plate(c) != null)
                .map(c -> TurkishProvinces.slug(c) + "-" + String.format("%02d", TurkishProvinces.plate(c)))
                .toList();
    }

    public boolean contains(String city) {
        if (city == null || city.isBlank()) {
            return false;
        }
        String normalized = normalize(city);
        return getCities().stream().map(LaunchCityConfig::normalize).anyMatch(normalized::equals);
    }

    public String firstCity() {
        return getCities().get(0);
    }

    public String ticketmasterCity(String city) {
        return switch (normalize(city)) {
            case "istanbul" -> "Istanbul";
            case "izmir" -> "Izmir";
            case "ankara" -> "Ankara";
            case "antalya" -> "Antalya";
            default -> TurkishProvinces.ascii(city);
        };
    }

    /**
     * Türkçe harf duyarsız şehir anahtarı: "İstanbul"/"Istanbul" → "istanbul",
     * "Eskişehir"/"Eskisehir" → "eskisehir". EventRepository'deki TRANSLATE ile aynı kural.
     */
    public static String normalize(String city) {
        StringBuilder sb = new StringBuilder(city.length());
        for (char c : city.trim().toCharArray()) {
            int i = FROM.indexOf(c);
            sb.append(i >= 0 ? TO.charAt(i) : c);
        }
        return sb.toString().toLowerCase(Locale.ROOT);
    }

    private static final String FROM = "İIıŞşĞğÜüÖöÇç";
    private static final String TO = "iiissgguuoocc";
}
