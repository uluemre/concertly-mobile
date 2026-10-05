package com.concertly.backend.service.ingest;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Zorlu PSM kaynağını ortak arayüze bağlar. Yazma kuralları diğer bilet siteleriyle
 * ortak (BiletinialImportService.importRecords): doğrulama, kayıt başına transaction,
 * müzik dışı filtresi, kaynak satırı.
 */
@Service
public class ZorluPsmConcertSource implements ConcertSource {

    public static final String CODE = ZorluPsmSource.SOURCE;

    private final ZorluPsmSource source;
    private final SourcePageCrawler crawler;
    private final BiletinialImportService importService;
    private final boolean enabled;
    private final int maxNewPagesPerRun;

    public ZorluPsmConcertSource(ZorluPsmSource source,
            SourcePageCrawler crawler,
            BiletinialImportService importService,
            @Value("${app.sources.zorlupsm.enabled:true}") boolean enabled,
            @Value("${app.sources.zorlupsm.max-new-pages:300}") int maxNewPagesPerRun) {
        this.source = source;
        this.crawler = crawler;
        this.importService = importService;
        this.enabled = enabled;
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

    @Override
    public SourceSyncResult sync() {
        long started = System.currentTimeMillis();
        List<String> urls = source.sitemapEventUrls();
        // Tablo yoksa (migration uygulanmamış) haritanın en yeni 40 sayfası açılır
        List<String> fallback = urls.subList(0, Math.min(urls.size(), 40));
        Set<RawConcertData> unique = new LinkedHashSet<>(
                crawler.crawl(CODE, urls, maxNewPagesPerRun, fallback, source::fetchPage));
        BiletinialImportService.ImportResult result = importService.importRecords(new ArrayList<>(unique));
        return SourceSyncResult.ok(CODE, result.fetched(), result.created(), result.updated(),
                result.skipped(), System.currentTimeMillis() - started);
    }
}
