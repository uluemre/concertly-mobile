package com.concertly.backend.service.ingest;

/**
 * Bir konser veri kaynagi.
 *
 * Yeni kaynak eklemek icin tek yapilmasi gereken bu arayuzu uygulayan bir
 * @Service yazmak; zamanlayici tum ConcertSource bean'lerini kendisi bulur,
 * ayrica kayit olmaya gerek yok.
 *
 * Bilerek kucuk tutuldu: kaynaklarin veriyi nasil cektigi (JSON-LD, REST,
 * HTML) kendi ic meselesi. Ortaklastirilan tek sey "calis ve ne oldugunu
 * raporla" davranisi.
 */
public interface ConcertSource {

    /** Loglarda ve raporda gorunen kisa kod, ornegin BILETINIAL. */
    String code();

    /** Kapatilabilirlik: yapilandirmayla devre disi birakilan kaynak atlanir. */
    default boolean isEnabled() {
        return true;
    }

    /**
     * Kaynagi senkronize eder.
     *
     * Istisna firlatabilir; zamanlayici yakalar ve diger kaynaklar calismaya
     * devam eder.
     */
    SourceSyncResult sync();
}
