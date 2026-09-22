package com.concertly.backend.service.ingest;

import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * Ham kaydin veritabanina girmeye uygun olup olmadigini denetler.
 *
 * Kaynak sitede bozuk ya da cok eski bir kayit oldugunda bunun listeye
 * sizmasini istemiyoruz. Kurallar bilerek genis: amac cop veriyi elemek,
 * mesru konseri reddetmek degil.
 */
@Component
public class RawConcertValidator {

    /** Gecmisin bu kadar otesindeki etkinlik artik listelenmez. */
    private static final int MAX_PAST_DAYS = 1;

    /** Bu kadar ileri tarihli kayit veri hatasi sayilir. */
    private static final int MAX_FUTURE_YEARS = 3;

    private static final int MAX_NAME_LENGTH = 300;

    /** @return null ise kayit gecerli, aksi halde reddetme gerekcesi */
    public String validate(RawConcertData raw) {
        if (raw == null) return "kayit yok";
        if (!raw.isUsable()) return "zorunlu alan eksik (ad/tarih/mekan)";

        String name = raw.concertName();
        if (name.length() > MAX_NAME_LENGTH) return "etkinlik adi cok uzun";

        LocalDateTime date = raw.startsAt();
        LocalDateTime now = LocalDateTime.now();
        if (date.isBefore(now.minusDays(MAX_PAST_DAYS))) return "gecmis tarihli";
        if (date.isAfter(now.plusYears(MAX_FUTURE_YEARS))) return "makul olmayan ileri tarih";

        Double lat = raw.latitude();
        Double lon = raw.longitude();
        if (lat != null && (lat < -90 || lat > 90)) return "enlem araligi disinda";
        if (lon != null && (lon < -180 || lon > 180)) return "boylam araligi disinda";

        return null;
    }

    public boolean isValid(RawConcertData raw) {
        return validate(raw) == null;
    }
}
