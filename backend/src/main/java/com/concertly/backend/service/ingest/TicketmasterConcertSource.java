package com.concertly.backend.service.ingest;

import com.concertly.backend.service.TicketmasterService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Ticketmaster kaynagini ortak arayuze baglar.
 *
 * Bilerek ADAPTOR: TicketmasterService'in kendi ice aktarma mantigi oldugu gibi
 * duruyor, tek satiri degismedi. Boylece calisan akis korunurken kaynak yeni
 * mimariye dahil oluyor.
 *
 * Not: TicketmasterService kendi upsert islemini iceride yapip yalnizca toplam
 * sayiyi donduruyor, bu yuzden yeni/guncel ayrimi raporlanamiyor.
 */
@Service
public class TicketmasterConcertSource implements ConcertSource {

    public static final String CODE = "TICKETMASTER";

    private final TicketmasterService ticketmasterService;
    private final boolean enabled;

    public TicketmasterConcertSource(TicketmasterService ticketmasterService,
            @Value("${app.sources.ticketmaster.enabled:true}") boolean enabled) {
        this.ticketmasterService = ticketmasterService;
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
        int processed = ticketmasterService.syncTurkeyEvents();
        return SourceSyncResult.ok(CODE, processed, null, null, 0,
                System.currentTimeMillis() - started);
    }
}
