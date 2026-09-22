package com.concertly.backend.service.ingest;

import com.concertly.backend.model.Event;
import com.concertly.backend.repository.EventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Biletinial ham kayitlarini Concertly modeline yazar.
 *
 * Yeni entity YOK: kayitlar mevcut Artist / Venue / Event tablolarina duser.
 * Kaynak ayirt edilebilir kalsin diye iki isaret birden kullanilir:
 *   - Event.source = BILETINIAL (okunabilir, sorgulanabilir)
 *   - Event.externalId = biletinial:slug@seans-tarihi (mukerrer anahtari)
 *
 * Mukerrer kurali bu asamada yalnizca AYNI KAYNAK icindir: ayni Biletinial
 * etkinligi tekrar cekildiginde yeni satir acilmaz, mevcut satir guncellenir.
 * Ticketmaster ile ayni konserin birlestirilmesi sonraki asamaya birakildi;
 * bu yuzden Ticketmaster kayitlarina hic dokunulmaz.
 *
 * Ayni sanatci farkli sehir/tarihteyse AYRI etkinliktir: anahtar seans
 * tarihini de icerdigi icin bir turnenin her duragi kendi satirini alir.
 */
@Service
public class BiletinialImportService {

    /** Ticketmaster kimlikleriyle karismasin diye kaynak on eki. */
    public static final String EXTERNAL_ID_PREFIX = "biletinial:";

    private static final Logger log = LoggerFactory.getLogger(BiletinialImportService.class);

    private final BiletinialSource source;
    private final BiletinialRecordWriter writer;
    private final RawConcertValidator validator;
    private final EventRepository eventRepository;
    private final List<String> citySlugs;
    private final int maxEventPagesPerCity;

    public BiletinialImportService(BiletinialSource source,
            BiletinialRecordWriter writer,
            RawConcertValidator validator,
            EventRepository eventRepository,
            @Value("${app.sources.biletinial.city-slugs:istanbul,ankara,izmir,antalya}") String citySlugs,
            @Value("${app.sources.biletinial.max-pages-per-city:25}") int maxEventPagesPerCity) {
        this.source = source;
        this.writer = writer;
        this.validator = validator;
        this.eventRepository = eventRepository;
        this.citySlugs = List.of(citySlugs.split(","));
        this.maxEventPagesPerCity = maxEventPagesPerCity;
    }

    /** Ice aktarim sonucu, cagiran taraf ne oldugunu gorebilsin. */
    public record ImportResult(int fetched, int created, int updated, int skipped) {
        public int total() { return created + updated; }
    }

    /**
     * Yapilandirilmis sehir listelerini gezer ve kayitlari yazar.
     *
     * Sehir listeleri kesif icin kullanilir, FILTRE olarak degil: bir turne
     * sayfasi baska sehirlerin seanslarini da tasidigi icin ulke genelinden
     * kayit gelebilir ve bunlar da kabul edilir. Sehir suzmesi mobil tarafta
     * zaten var.
     */
    public ImportResult importAll() {
        Set<RawConcertData> unique = new LinkedHashSet<>();
        for (String slug : citySlugs) {
            String city = slug.trim();
            if (city.isEmpty()) continue;
            unique.addAll(source.fetchCity(city, maxEventPagesPerCity));
        }
        return importRecords(new ArrayList<>(unique));
    }

    /**
     * Ham kayitlari yazar.
     *
     * Her kayit KENDI transaction'inda islenir (bkz. BiletinialRecordWriter):
     * tek bir bozuk kayit partinin geri kalanini dusurmez. Daha once tum parti
     * tek transaction icindeydi ve veritabani bir ifadeyi reddettiginde
     * transaction iptal oldugu icin sonraki kayitlar da kayboluyordu.
     */
    public ImportResult importRecords(List<RawConcertData> records) {
        int created = 0, updated = 0, skipped = 0;
        for (RawConcertData raw : records) {
            String problem = validator.validate(raw);
            if (problem != null) {
                skipped++;
                log.debug("Kayit atlandi ({}): {}", raw.sourceEventId(), problem);
                continue;
            }
            try {
                if (writer.upsert(raw)) created++; else updated++;
            } catch (Exception e) {
                skipped++;
                log.warn("Biletinial kaydi yazilamadi ({}): {}", raw.sourceEventId(), e.getMessage());
            }
        }
        log.info("Biletinial ice aktarim: {} cekildi, {} yeni, {} guncellendi, {} atlandi",
                records.size(), created, updated, skipped);
        return new ImportResult(records.size(), created, updated, skipped);
    }

    /** Ice aktarilmis Biletinial etkinlikleri (dogrulama ve raporlama icin). */
    public List<Event> importedEvents() {
        return eventRepository.findAll().stream()
                .filter(e -> e.getExternalId() != null && e.getExternalId().startsWith(EXTERNAL_ID_PREFIX))
                .toList();
    }
}
