package com.concertly.backend.dto.request;

import java.time.LocalDateTime;

/**
 * Kullanıcı/organizatör etkinlik önerisi.
 *
 * Mekan ve sanatçı id yerine ADLA gelir: öneren kişi veritabanındaki kayıtları
 * bilmez. Eşleştirme/oluşturma sunucuda yapılır.
 */
public class SuggestEventRequest {

    private String name;
    private String description;
    private LocalDateTime eventDate;

    private String artistName;
    private String artistGenre;

    private String venueName;
    private String venueCity;
    private String venueAddress;
    private Double venueLatitude;
    private Double venueLongitude;

    private String ticketUrl;
    private String imageUrl;
    /** Instagram gönderisi / mekan sitesi — moderatörün doğrulayacağı bağlantı. */
    private String sourceUrl;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public LocalDateTime getEventDate() { return eventDate; }
    public void setEventDate(LocalDateTime eventDate) { this.eventDate = eventDate; }

    public String getArtistName() { return artistName; }
    public void setArtistName(String artistName) { this.artistName = artistName; }

    public String getArtistGenre() { return artistGenre; }
    public void setArtistGenre(String artistGenre) { this.artistGenre = artistGenre; }

    public String getVenueName() { return venueName; }
    public void setVenueName(String venueName) { this.venueName = venueName; }

    public String getVenueCity() { return venueCity; }
    public void setVenueCity(String venueCity) { this.venueCity = venueCity; }

    public String getVenueAddress() { return venueAddress; }
    public void setVenueAddress(String venueAddress) { this.venueAddress = venueAddress; }

    public Double getVenueLatitude() { return venueLatitude; }
    public void setVenueLatitude(Double venueLatitude) { this.venueLatitude = venueLatitude; }

    public Double getVenueLongitude() { return venueLongitude; }
    public void setVenueLongitude(Double venueLongitude) { this.venueLongitude = venueLongitude; }

    public String getTicketUrl() { return ticketUrl; }
    public void setTicketUrl(String ticketUrl) { this.ticketUrl = ticketUrl; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public String getSourceUrl() { return sourceUrl; }
    public void setSourceUrl(String sourceUrl) { this.sourceUrl = sourceUrl; }
}
