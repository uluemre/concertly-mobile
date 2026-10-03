package com.concertly.backend.service.ingest;

import java.time.LocalDateTime;

/**
 * Bir konser kaynagindan cekilen ham kayit.
 *
 * Kaynaga ozgu alan adlarini burada tek bir bicime indiriyoruz; boylece
 * ilerideki asamalarda eslestirme ve kayit mantigi kaynagi hic bilmeden
 * calisabilir. Bu tip bilerek JPA entity DEGILDIR ve veritabanina yazilmaz.
 *
 * Not: startsAt, Europe/Istanbul duvar saatidir. Kaynak tarihi saat dilimiyle
 * verir (ornegin +03:00); uygulamanin geri kalani LocalDateTime ile calistigi
 * icin donusum cekme anindan yapilir.
 */
public record RawConcertData(
        /** Kaynak kodu, ornegin BILETINIAL. */
        String source,
        /** Kaynak icindeki benzersiz kimlik (slug + seans tarihi). */
        String sourceEventId,
        String artistName,
        String concertName,
        LocalDateTime startsAt,
        String venueName,
        String venueAddress,
        String city,
        Double latitude,
        Double longitude,
        String ticketUrl,
        String imageUrl,
        /** Kaynak bu seansi iptal edilmis olarak bildiriyor (schema.org EventCancelled). */
        boolean cancelled) {

    /** Iptal bilgisi olmayan kaynaklar ve testler icin (cancelled = false). */
    public RawConcertData(String source, String sourceEventId, String artistName, String concertName,
                          LocalDateTime startsAt, String venueName, String venueAddress, String city,
                          Double latitude, Double longitude, String ticketUrl, String imageUrl) {
        this(source, sourceEventId, artistName, concertName, startsAt, venueName, venueAddress, city,
                latitude, longitude, ticketUrl, imageUrl, false);
    }

    /** Konum dogrulamasi icin koordinat var mi. */
    public boolean hasCoordinates() {
        return latitude != null && longitude != null;
    }

    /** Concertly modeline baglanabilmesi icin gereken asgari alanlar. */
    public boolean isUsable() {
        return concertName != null && !concertName.isBlank()
                && startsAt != null
                && venueName != null && !venueName.isBlank();
    }
}
