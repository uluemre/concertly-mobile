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
    private final SourcePageCrawler crawler;
    private final int maxNewPagesPerRun;

    public BubiletConcertSource(BubiletSource source,
            BiletinialImportService importService,
            @Value("${app.sources.bubilet.enabled:true}") boolean enabled,
            @Value("${app.sources.bubilet.city-slugs:istanbul,ankara,izmir,antalya}") String citySlugs,
            @Value("${app.sources.bubilet.max-pages-per-city:25}") int maxEventPagesPerCity,
            SourcePageCrawler crawler,
            @Value("${app.sources.bubilet.max-new-pages:400}") int maxNewPagesPerRun) {
        this.source = source;
        this.importService = importService;
        this.enabled = enabled;
        this.citySlugs = List.of(citySlugs.split(","));
        this.maxEventPagesPerCity = maxEventPagesPerCity;
        this.crawler = crawler;
        this.maxNewPagesPerRun = maxNewPagesPerRun;
    }

    @Override
    public String code() {
        return CODE;
    }

    @Override
    public boolean isEnabled() {
        return enabled;
    }

    /**
     * Keşif iki yoldan: şehir konser listesi (ilk 25, kesin konser) + site haritası
     * (tüm etkinlikler; konser olanlar sayfa açılınca etiketinden anlaşılır ve
     * SourcePageCrawler bunu hatırlar).
     */
    @Override
    public SourceSyncResult sync() {
        long started = System.currentTimeMillis();
        List<String> cities = citySlugs.stream().map(String::trim).filter(c -> !c.isEmpty()).toList();

        Set<String> listing = new LinkedHashSet<>();
        for (String city : cities) {
            List<String> urls = source.listEventUrls(city);
            listing.addAll(urls.subList(0, Math.min(urls.size(), maxEventPagesPerCity)));
        }
        Set<String> candidates = new LinkedHashSet<>(listing);
        candidates.addAll(source.sitemapEventUrls(cities));

        Set<RawConcertData> unique = new LinkedHashSet<>(
                crawler.crawl(CODE, candidates, maxNewPagesPerRun, listing, source::fetchPage));
        BiletinialImportService.ImportResult result = importService.importRecords(new ArrayList<>(unique));
        return SourceSyncResult.ok(CODE, result.fetched(), result.created(), result.updated(),
                result.skipped(), System.currentTimeMillis() - started);
    }
}
