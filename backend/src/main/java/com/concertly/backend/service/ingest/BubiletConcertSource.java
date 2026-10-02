package com.concertly.backend.service.ingest;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Bubilet kaynagini ortak arayuze baglar.
 *
 * Yazma kurallari Biletinial ile ortaktir (BiletinialImportService.importRecords):
 * dogrulama, kayit bazinda transaction, muzik disi filtresi, kaynak satiri.
 */
@Service
public class BubiletConcertSource implements ConcertSource {

    public static final String CODE = "BUBILET";

    private final BubiletSource source;
    private final BiletinialImportService importService;
    private final boolean enabled;
    private final List<String> citySlugs;
    private final int maxEventPagesPerCity;

    public BubiletConcertSource(BubiletSource source,
            BiletinialImportService importService,
            @Value("${app.sources.bubilet.enabled:true}") boolean enabled,
            @Value("${app.sources.bubilet.city-slugs:istanbul,ankara,izmir,antalya}") String citySlugs,
            @Value("${app.sources.bubilet.max-pages-per-city:25}") int maxEventPagesPerCity) {
        this.source = source;
        this.importService = importService;
        this.enabled = enabled;
        this.citySlugs = List.of(citySlugs.split(","));
        this.maxEventPagesPerCity = maxEventPagesPerCity;
    }

    @Override
    public String code() {
        return CODE;
    }

    @Override
    public boolean isEnabled() {
        return enabled;
    }

    @Override
    public SourceSyncResult sync() {
        long started = System.currentTimeMillis();
        Set<RawConcertData> unique = new LinkedHashSet<>();
        for (String slug : citySlugs) {
            String city = slug.trim();
            if (!city.isEmpty()) unique.addAll(source.fetchCity(city, maxEventPagesPerCity));
        }
        BiletinialImportService.ImportResult result = importService.importRecords(new ArrayList<>(unique));
        return SourceSyncResult.ok(CODE, result.fetched(), result.created(), result.updated(),
                result.skipped(), System.currentTimeMillis() - started);
    }
}
