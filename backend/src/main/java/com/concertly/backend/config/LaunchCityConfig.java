package com.concertly.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

@Component
public class LaunchCityConfig {

    private final List<String> cities;

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
        return cities;
    }

    public boolean contains(String city) {
        if (city == null || city.isBlank()) {
            return false;
        }
        String normalized = normalize(city);
        return cities.stream().map(LaunchCityConfig::normalize).anyMatch(normalized::equals);
    }

    public String firstCity() {
        return cities.get(0);
    }

    public String ticketmasterCity(String city) {
        return switch (normalize(city)) {
            case "istanbul" -> "Istanbul";
            case "izmir" -> "Izmir";
            case "ankara" -> "Ankara";
            case "antalya" -> "Antalya";
            default -> city;
        };
    }

    public static String normalize(String city) {
        return city.trim()
                .replace('İ', 'I')
                .replace('ı', 'i')
                .toLowerCase(Locale.ROOT);
    }
}
