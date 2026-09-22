package com.concertly.backend.dto.response;

import com.concertly.backend.model.Event;

import java.time.LocalDateTime;

/**
 * Mobil uygulamaya sunulan konser kaydi.
 *
 * Kaynak bilgisi (source, sourceUrl, externalId) BILEREK yok: mobil tarafin
 * verinin Ticketmaster'dan mi Biletinial'den mi geldigini bilmesine gerek
 * yok ve bilmemeli. Akis tek yonlu: kaynaklar -> backend -> veritabani ->
 * bu API -> uygulama.
 */
public class ConcertResponse {

    private Long id;
    private String name;
    private LocalDateTime eventDate;
    private String genre;
    private String imageUrl;
    private String ticketUrl;
    /** Kaynagi dogrulanmis etkinlik rozeti (bilet platformu ya da admin incelemesi). */
    private Boolean isVerified;

    private Long artistId;
    private String artistName;
    private String artistImageUrl;

    private Long venueId;
    private String venueName;
    private String venueCity;
    private String venueAddress;
    private Double venueLatitude;
    private Double venueLongitude;

    public static ConcertResponse from(Event event) {
        ConcertResponse dto = new ConcertResponse();
        dto.id = event.getId();
        dto.name = event.getName();
        dto.eventDate = event.getEventDate();
        dto.genre = event.getGenre();
        dto.imageUrl = event.getImageUrl();
        dto.ticketUrl = event.getTicketUrl();
        dto.isVerified = event.getIsVerified();

        if (event.getArtist() != null) {
            dto.artistId = event.getArtist().getId();
            dto.artistName = event.getArtist().getName();
            dto.artistImageUrl = event.getArtist().getImageUrl();
        }
        if (event.getVenue() != null) {
            dto.venueId = event.getVenue().getId();
            dto.venueName = event.getVenue().getName();
            dto.venueCity = event.getVenue().getCity();
            dto.venueAddress = event.getVenue().getAddress();
            dto.venueLatitude = event.getVenue().getLatitude();
            dto.venueLongitude = event.getVenue().getLongitude();
        }
        return dto;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public LocalDateTime getEventDate() { return eventDate; }
    public String getGenre() { return genre; }
    public String getImageUrl() { return imageUrl; }
    public String getTicketUrl() { return ticketUrl; }
    public Boolean getIsVerified() { return isVerified; }
    public Long getArtistId() { return artistId; }
    public String getArtistName() { return artistName; }
    public String getArtistImageUrl() { return artistImageUrl; }
    public Long getVenueId() { return venueId; }
    public String getVenueName() { return venueName; }
    public String getVenueCity() { return venueCity; }
    public String getVenueAddress() { return venueAddress; }
    public Double getVenueLatitude() { return venueLatitude; }
    public Double getVenueLongitude() { return venueLongitude; }
}
