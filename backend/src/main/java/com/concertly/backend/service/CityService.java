package com.concertly.backend.service;

import com.concertly.backend.config.LaunchCityConfig;
import com.concertly.backend.config.TurkishProvinces;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.City;
import com.concertly.backend.repository.CityRepository;
import jakarta.persistence.EntityManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Şehir kapsamı: hangi şehirler listelenir, önerilir ve bilet sitelerinden taranır.
 *
 * 81 il cities tablosunda durur; admin açıp kapatır. Açık şehirler LaunchCityConfig'e
 * bildirilir, uygulamanın geri kalanı (EventService, kaynaklar, Ticketmaster) oradan okur.
 * Tablo yoksa (migration uygulanmamış) ayar dosyasındaki liste kullanılmaya devam eder.
 */
@Service
public class CityService {

    private static final Logger log = LoggerFactory.getLogger(CityService.class);

    private final CityRepository cityRepository;
    private final LaunchCityConfig launchCityConfig;
    private final EntityManager em;

    public CityService(CityRepository cityRepository, LaunchCityConfig launchCityConfig, EntityManager em) {
        this.cityRepository = cityRepository;
        this.launchCityConfig = launchCityConfig;
        this.em = em;
    }

    /** Açılışta: eksik illeri ekle, açık şehirleri yükle. */
    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        try {
            seedProvinces();
            reload();
        } catch (Exception e) {
            log.warn("Sehir tablosu okunamadi ({}); ayar listesi kullaniliyor: {}",
                    e.getMessage(), launchCityConfig.getConfiguredCities());
        }
    }

    /**
     * 81 il yoksa eklenir. Tablo İLK KEZ doluyorsa ayar listesindeki şehirler açık gelir;
     * sonradan eklenen il kapalı gelir (adminin kararını ezmemek için).
     */
    @Transactional
    public void seedProvinces() {
        List<City> existing = cityRepository.findAll();
        boolean firstSeed = existing.isEmpty();
        Set<String> known = new HashSet<>();
        for (City c : existing) known.add(c.getSlug());
        Set<String> initiallyOpen = new HashSet<>();
        for (String c : launchCityConfig.getConfiguredCities()) initiallyOpen.add(TurkishProvinces.slug(c));

        List<City> added = new ArrayList<>();
        for (Map.Entry<String, Integer> p : TurkishProvinces.PLATES.entrySet()) {
            String slug = TurkishProvinces.slug(p.getKey());
            if (known.contains(slug)) continue;
            City city = new City();
            city.setName(p.getKey());
            city.setSlug(slug);
            city.setPlate(p.getValue());
            city.setEnabled(firstSeed && initiallyOpen.contains(slug));
            added.add(city);
        }
        if (!added.isEmpty()) {
            cityRepository.saveAll(added);
            log.info("{} il eklendi (ilk kurulum: {})", added.size(), firstSeed);
        }
    }

    /** Açık şehirleri LaunchCityConfig'e yükler. */
    public List<String> reload() {
        List<String> enabled = cityRepository.findAllByOrderByPlateAsc().stream()
                .filter(City::isEnabled)
                .sorted(Comparator.comparing(City::getPlate))
                .map(City::getName)
                .toList();
        launchCityConfig.refresh(enabled);
        log.info("Acik sehirler: {}", enabled);
        return enabled;
    }

    /** Uygulamanın kullandığı açık şehirler (önce büyük şehirler: ayar sırasıyla, sonra alfabetik). */
    public List<String> enabledCities() {
        List<String> cities = new ArrayList<>(launchCityConfig.getCities());
        List<String> preferred = launchCityConfig.getConfiguredCities();
        Comparator<String> order = Comparator
                .comparingInt((String c) -> {
                    int i = indexOfNormalized(preferred, c);
                    return i < 0 ? Integer.MAX_VALUE : i;
                })
                .thenComparing(c -> LaunchCityConfig.normalize(c));
        cities.sort(order);
        return cities;
    }

    private static int indexOfNormalized(List<String> list, String city) {
        String key = LaunchCityConfig.normalize(city);
        for (int i = 0; i < list.size(); i++) {
            if (LaunchCityConfig.normalize(list.get(i)).equals(key)) return i;
        }
        return -1;
    }

    /** Admin satırı: il, açık mı, yaklaşan (listelenen) konser sayısı. */
    public record AdminCity(Long id, String name, int plate, boolean enabled, long upcomingEvents) {}

    @Transactional(readOnly = true)
    public List<AdminCity> adminList() {
        Map<String, Long> counts = upcomingCountsByCity();
        List<AdminCity> out = new ArrayList<>();
        for (City c : cityRepository.findAllByOrderByPlateAsc()) {
            out.add(new AdminCity(c.getId(), c.getName(), c.getPlate(), c.isEnabled(),
                    counts.getOrDefault(LaunchCityConfig.normalize(c.getName()), 0L)));
        }
        // Açıklar önce, sonra konser sayısı çok olan
        out.sort(Comparator.comparing(AdminCity::enabled).reversed()
                .thenComparing(Comparator.comparingLong(AdminCity::upcomingEvents).reversed())
                .thenComparing(AdminCity::plate));
        return out;
    }

    @Transactional
    public AdminCity setEnabled(Long id, boolean enabled) {
        City city = cityRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("CITY_NOT_FOUND"));
        if (!enabled && city.isEnabled() && cityRepository.findAll().stream().filter(City::isEnabled).count() <= 1) {
            // Son açık şehir kapatılırsa liste ayar dosyasına döner; bu yanıltıcı olur
            throw new IllegalArgumentException("LAST_CITY");
        }
        city.setEnabled(enabled);
        city.setUpdatedAt(LocalDateTime.now());
        cityRepository.save(city);
        reload();
        log.info("Sehir {} {}", city.getName(), enabled ? "acildi" : "kapatildi");
        return new AdminCity(city.getId(), city.getName(), city.getPlate(), city.isEnabled(),
                upcomingCountsByCity().getOrDefault(LaunchCityConfig.normalize(city.getName()), 0L));
    }

    /** Şehir anahtarı (normalize) → yaklaşan, listelenen konser sayısı. */
    private Map<String, Long> upcomingCountsByCity() {
        List<Object[]> rows = em.createQuery(
                        "SELECT e.venue.city, COUNT(e) FROM Event e WHERE e.eventDate >= :now "
                                + "AND e.isApproved = true AND e.delistedReason IS NULL AND e.venue IS NOT NULL "
                                + "GROUP BY e.venue.city", Object[].class)
                .setParameter("now", LocalDateTime.now())
                .getResultList();
        Map<String, Long> out = new HashMap<>();
        for (Object[] r : rows) {
            if (r[0] == null) continue;
            out.merge(LaunchCityConfig.normalize((String) r[0]), ((Number) r[1]).longValue(), Long::sum);
        }
        return out;
    }
}
