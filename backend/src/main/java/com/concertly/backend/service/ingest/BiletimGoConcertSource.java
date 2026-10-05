package com.concertly.backend.service.ingest;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * BiletimGo kaynağını ortak arayüze bağlar. Şehir takvimlerinin konser filtresinden
 * keşfedilen sayfalar okunur; yazma kuralları diğer bilet siteleriyle ortaktır.
 */
@Service
public class BiletimGoConcertSource implements ConcertSource {

    public static final String CODE = BiletimGoSource.SOURCE;

    private final BiletimGoSource source;
    private final BiletinialImportService importService;
    private final boolean enabled;
    private final List<String> cityCodes;

    public BiletimGoConcertSource(BiletimGoSource source,
            BiletinialImportService importService,
            @Value("${app.sources.biletimgo.enabled:true}") boolean enabled,
            @Value("${app.sources.biletimgo.city-codes:istanbul-34,ankara-06,izmir-35,antalya-07}") String cityCodes) {
        this.source = source;
        this.importService = importService;
        this.enabled = enabled;
        this.cityCodes = List.of(cityCodes.split(","));
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
        Set<String> urls = new LinkedHashSet<>();
        for (String code : cityCodes) {
            if (!code.isBlank()) urls.addAll(source.listConcertUrls(code.trim()));
        }
        List<RawConcertData> records = new ArrayList<>();
        int unreadable = 0;
        for (String url : urls) {
            RawConcertData raw = source.fetchEvent(url);
            if (raw == null) unreadable++;
            else records.add(raw);
        }
        BiletinialImportService.ImportResult result = importService.importRecords(records);
        return SourceSyncResult.ok(CODE, result.fetched(), result.created(), result.updated(),
                result.skipped() + unreadable, System.currentTimeMillis() - started);
    }
}
