package com.concertly.backend.service.ingest;

import com.concertly.backend.model.Artist;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventSource;
import com.concertly.backend.model.Venue;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.VenueRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tek bir Biletinial kaydini yazar.
 *
 * Neden ayri sinif: her kayit KENDI transaction'inda islenmeli. Tum partiyi
 * tek transaction icinde yazip kayit bazinda hata yutmak ise yaramiyor —
 * veritabani tek bir ifadeyi reddettiginde transaction zaten iptal edilmis
 * oluyor ve sonraki kayitlar da dusuyordu. Ayri bean olmasi, Spring proxy
 * uzerinden REQUIRES_NEW uygulanabilmesi icin gerekli.
 */
@Service
public class BiletinialRecordWriter {

    private final EventRepository eventRepository;
    private final ArtistRepository artistRepository;
    private final VenueRepository venueRepository;

    public BiletinialRecordWriter(EventRepository eventRepository,
            ArtistRepository artistRepository,
            VenueRepository venueRepository) {
        this.eventRepository = eventRepository;
        this.artistRepository = artistRepository;
        this.venueRepository = venueRepository;
    }

    /**
     * Kaydi ekler ya da gunceller.
     *
     * @return yeni kayit olusturulduysa true
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean upsert(RawConcertData raw) {
        String externalId = BiletinialImportService.EXTERNAL_ID_PREFIX + raw.sourceEventId();
        Event event = eventRepository.findByExternalId(externalId).orElse(null);
        boolean isNew = event == null;
        if (isNew) {
            event = new Event();
            event.setExternalId(externalId);
        }

        Artist artist = findOrCreateArtist(raw);
        Venue venue = findOrCreateVenue(raw);

        event.setName(raw.concertName());
        event.setEventDate(raw.startsAt());
        event.setArtist(artist);
        event.setVenue(venue);
        event.setTicketUrl(raw.ticketUrl());
        event.setImageUrl(raw.imageUrl());
        event.setGenre(artist != null ? artist.getGenre() : null);
        // Bilet platformundan geldigi icin yayina hazir ve kaynagi dogrulanmis sayilir.
        event.setIsApproved(true);
        event.setIsVerified(true);
        event.setSource(EventSource.BILETINIAL);
        event.setSourceUrl(raw.ticketUrl());

        eventRepository.save(event);
        return isNew;
    }

    /**
     * Sanatciyi adiyla bulur, yoksa olusturur.
     *
     * Eslesme buyuk/kucuk harf duyarsiz tam addir; Biletinial kendi icinde
     * tutarli yazdigi icin tekrar cekimlerde ayni sanatci yeniden kullanilir.
     * Kaynaklar arasi isim varyantlarini birlestirmek ASAMA 4 isidir.
     */
    private Artist findOrCreateArtist(RawConcertData raw) {
        String name = raw.artistName();
        if (name == null || name.isBlank()) return null;
        String trimmed = name.trim();
        return artistRepository.findFirstByNameIgnoreCase(trimmed)
                .orElseGet(() -> {
                    Artist artist = new Artist();
                    artist.setName(trimmed);
                    artist.setGenre("Diger");
                    return artistRepository.save(artist);
                });
    }

    /** Mekani ad + sehir ile bulur, yoksa olusturur; eksik alanlari tamamlar. */
    private Venue findOrCreateVenue(RawConcertData raw) {
        String name = raw.venueName();
        if (name == null || name.isBlank()) return null;
        String city = raw.city() != null ? raw.city() : "";

        Venue venue = venueRepository.findFirstByNameAndCity(name.trim(), city).orElse(null);
        if (venue == null) {
            venue = new Venue();
            venue.setName(name.trim());
            venue.setCity(city);
            venue.setCountry("Turkiye");
        }
        // Var olan mekanin eksik alanlarini tamamla, DOLU olani ezme:
        // Ticketmaster ayni mekani daha zengin doldurmus olabilir.
        if (venue.getAddress() == null && raw.venueAddress() != null) venue.setAddress(raw.venueAddress());
        if (venue.getLatitude() == null && raw.latitude() != null) venue.setLatitude(raw.latitude());
        if (venue.getLongitude() == null && raw.longitude() != null) venue.setLongitude(raw.longitude());
        return venueRepository.save(venue);
    }
}
