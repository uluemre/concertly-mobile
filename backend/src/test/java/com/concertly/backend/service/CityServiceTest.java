package com.concertly.backend.service;

import com.concertly.backend.config.LaunchCityConfig;
import com.concertly.backend.config.TurkishProvinces;
import com.concertly.backend.model.City;
import com.concertly.backend.repository.CityRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

/** Şehir kapsamı: 81 il, ilk kurulumda açık şehirler, admin aç/kapa. */
class CityServiceTest {

    private final List<City> table = new ArrayList<>();
    private final LaunchCityConfig config = new LaunchCityConfig("İstanbul,Ankara,Eskişehir");
    private final CityRepository repo = mock(CityRepository.class);
    private final CityService service = new CityService(repo, config, mock(EntityManager.class, RETURNS_DEEP_STUBS));

    CityServiceTest() {
        when(repo.findAll()).thenAnswer(i -> new ArrayList<>(table));
        when(repo.findAllByOrderByPlateAsc()).thenAnswer(i -> table.stream()
                .sorted(Comparator.comparingInt(City::getPlate)).toList());
        when(repo.saveAll(anyList())).thenAnswer(i -> {
            long id = table.size() + 1;
            for (City c : (List<City>) i.getArgument(0)) {
                ReflectionTestUtils.setField(c, "id", id++);
                table.add(c);
            }
            return i.getArgument(0);
        });
        when(repo.save(any(City.class))).thenAnswer(i -> i.getArgument(0));
        when(repo.findById(any())).thenAnswer(i -> table.stream().filter(c -> c.getId().equals(i.getArgument(0))).findFirst());
    }

    private City city(String name) {
        return table.stream().filter(c -> c.getName().equals(name)).findFirst().orElseThrow();
    }

    @Test
    void firstSeedAddsAll81ProvincesAndOpensConfiguredOnes() {
        service.seedProvinces();
        assertEquals(81, table.size());
        assertTrue(city("Eskişehir").isEnabled());
        assertFalse(city("Konya").isEnabled());
        assertEquals(26, city("Eskişehir").getPlate());
        assertEquals("eskisehir", city("Eskişehir").getSlug());

        service.reload();
        assertEquals(List.of("Ankara", "Eskişehir", "İstanbul"), config.getCities(), "plaka sırasıyla");
    }

    @Test
    void reseedNeverOverridesAdminDecisions() {
        service.seedProvinces();
        city("Eskişehir").setEnabled(false);
        city("Konya").setEnabled(true);
        table.removeIf(c -> c.getName().equals("Düzce")); // sonradan eksik kalan il

        service.seedProvinces();
        assertEquals(81, table.size());
        assertFalse(city("Eskişehir").isEnabled(), "admin kapattıysa kapalı kalır");
        assertTrue(city("Konya").isEnabled());
        assertFalse(city("Düzce").isEnabled(), "sonradan eklenen il kapalı gelir");
    }

    @Test
    void toggleRefreshesTheLiveCityList() {
        service.seedProvinces();
        service.reload();
        service.setEnabled(city("Konya").getId(), true);
        assertTrue(config.contains("Konya"));
        assertTrue(config.citySlugs().contains("konya"));
        assertTrue(config.slugPlateCodes().contains("konya-42"));

        service.setEnabled(city("Konya").getId(), false);
        assertFalse(config.contains("Konya"));
    }

    @Test
    void lastOpenCityCannotBeClosed() {
        service.seedProvinces();
        service.setEnabled(city("Ankara").getId(), false);
        service.setEnabled(city("Eskişehir").getId(), false);
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> service.setEnabled(city("İstanbul").getId(), false));
        assertEquals("LAST_CITY", e.getMessage());
    }

    @Test
    void cityMatchingIgnoresAllTurkishLetters() {
        assertEquals("eskisehir", LaunchCityConfig.normalize("Eskişehir"));
        assertEquals("eskisehir", LaunchCityConfig.normalize("ESKİŞEHİR"));
        assertEquals("istanbul", LaunchCityConfig.normalize("Istanbul"));
        assertTrue(config.contains("Eskisehir"));
        assertEquals("Eskisehir", config.ticketmasterCity("Eskişehir"));
        assertEquals("Istanbul", config.ticketmasterCity("İstanbul"));
    }

    @Test
    void provinceTableIsComplete() {
        assertEquals(81, TurkishProvinces.PLATES.size());
        assertEquals(34, TurkishProvinces.plate("Istanbul"));
        assertEquals(33, TurkishProvinces.plate("Mersin"));
        assertEquals(81, TurkishProvinces.plate("Düzce"));
        assertEquals("sanliurfa", TurkishProvinces.slug("Şanlıurfa"));
        assertEquals(81, new HashSet<>(TurkishProvinces.PLATES.values()).size(), "plakalar benzersiz");
    }
}
