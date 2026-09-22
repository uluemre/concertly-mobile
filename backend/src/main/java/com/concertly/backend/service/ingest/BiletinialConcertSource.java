package com.concertly.backend.service.ingest;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Biletinial kaynagini ortak arayuze baglar. */
@Service
public class BiletinialConcertSource implements ConcertSource {

    public static final String CODE = "BILETINIAL";

    private final BiletinialImportService importService;
    private final boolean enabled;

    public BiletinialConcertSource(BiletinialImportService importService,
            @Value("${app.sources.biletinial.enabled:true}") boolean enabled) {
        this.importService = importService;
        this.enabled = enabled;
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
        BiletinialImportService.ImportResult result = importService.importAll();
        return SourceSyncResult.ok(CODE, result.fetched(), result.created(), result.updated(),
                result.skipped(), System.currentTimeMillis() - started);
    }
}
