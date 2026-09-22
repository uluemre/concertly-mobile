package com.concertly.backend.config;

import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Lansman şehirleri eşleşmesi.
 *
 * 22 Eyl 2026'da canlıda şu hata yakalandı: application.properties UTF-8
 * yazılmıştı ama Spring .properties dosyalarını ISO-8859-1 okur, bu yüzden
 * "İstanbul" mojibake oluyordu ve şehir eşleşmesi sessizce başarısız oluyordu —
 * İstanbul için etkinlik listesi boş dönüyordu. Değer artık unicode kaçışıyla
 * yazılı; düz UTF-8'e geri dönülürse aşağıdaki son test kırılır.
 */
class LaunchCityConfigTest {

    private final LaunchCityConfig config =
            new LaunchCityConfig("İstanbul,Ankara,İzmir,Antalya");

    @Test
    void matchesTurkishSpelling() {
        assertTrue(config.contains("İstanbul"));
        assertTrue(config.contains("İzmir"));
    }

    /** İstemci noktasız I gönderebilir; eşleşme yine tutmalı. */
    @Test
    void matchesAsciiSpelling() {
        assertTrue(config.contains("Istanbul"));
        assertTrue(config.contains("istanbul"));
        assertTrue(config.contains("ISTANBUL"));
        assertTrue(config.contains("Izmir"));
    }

    @Test
    void rejectsCityOutsideScope() {
        assertFalse(config.contains("Trabzon"));
        assertFalse(config.contains(""));
        assertFalse(config.contains(null));
    }

    @Test
    void mapsCitiesToTicketmasterSpelling() {
        assertEquals("Istanbul", config.ticketmasterCity("İstanbul"));
        assertEquals("Izmir", config.ticketmasterCity("İzmir"));
        assertEquals("Ankara", config.ticketmasterCity("Ankara"));
    }

    @Test
    void blankConfigurationIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> new LaunchCityConfig(" , , "));
    }

    /**
     * Asıl regresyon testi: properties dosyası Spring ile AYNI şekilde okunur
     * (ISO-8859-1 + unicode kaçış çözümü). Şehirler düz UTF-8 yazılırsa burada
     * mojibake görünür ve test kırılır.
     */
    @Test
    void propertiesFileDecodesTurkishCharacters() throws Exception {
        Properties properties = new Properties();
        try (InputStream in = getClass().getResourceAsStream("/application.properties")) {
            assertNotNull(in, "application.properties bulunamadı");
            properties.load(in);
        }
        String value = properties.getProperty("app.launch.cities");
        assertNotNull(value);
        assertTrue(value.contains("İstanbul"), "beklenen İstanbul, gelen: " + value);
        assertTrue(value.contains("İzmir"), "beklenen İzmir, gelen: " + value);
        assertFalse(value.contains("Ä"), "mojibake tespit edildi: " + value);

        String defaults = value.substring(value.indexOf(':') + 1, value.length() - 1);
        LaunchCityConfig fromFile = new LaunchCityConfig(defaults);
        assertTrue(fromFile.contains("İstanbul"));
        assertTrue(fromFile.contains("Istanbul"));
    }
}
