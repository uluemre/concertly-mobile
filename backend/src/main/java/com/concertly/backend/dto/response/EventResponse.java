package com.concertly.backend.dto.response;

import com.concertly.backend.model.Event;

import java.time.LocalDateTime;

public class EventResponse {

    private Long id;
    private String name;
    private String description;
    private LocalDateTime eventDate;
    private Boolean isApproved;

    // Artist bilgileri
    private Long artistId;
    private String artistName;
    private String artistImageUrl;

    // 🔥 YENİ
    private String artistGenre;
    private String artistSpotifyId;

    // Venue bilgileri
    private Long venueId;
    private String venueName;
    private String venueCity;
    private String venueCountry;

    // 🔥 YENİ
    private String venueAddress;
    private String venueImageUrl;

    // 🔥 KOORDİNATLAR
    private Double venueLatitude;
    private Double venueLongitude;

    // Event ekstra
    private String genre;
    private String imageUrl;
    private String ticketUrl;

    // Oluşturan kullanıcı
    private Long createdByUserId;
    private String createdByUsername;

    public static EventResponse from(Event event) {
        EventResponse dto = new EventResponse();

        dto.id = event.getId();
        dto.name = event.getName();
        dto.description = event.getDescription();
        dto.eventDate = event.getEventDate();
        dto.isApproved = event.getIsApproved();

        // 🔥 EVENT EXTRA
        dto.genre = event.getGenre();
        dto.imageUrl = event.getImageUrl();
        dto.ticketUrl = event.getTicketUrl();

        // 🎤 ARTIST
        if (event.getArtist() != null) {
            dto.artistId = event.getArtist().getId();
            dto.artistName = event.getArtist().getName();
            dto.artistImageUrl = event.getArtist().getImageUrl();

            // 🔥 YENİ
            dto.artistGenre = event.getArtist().getGenre();
            dto.artistSpotifyId = event.getArtist().getSpotifyId();
        }

        // 📍 VENUE
        if (event.getVenue() != null) {
            dto.venueId = event.getVenue().getId();
            dto.venueName = event.getVenue().getName();
            dto.venueCity = event.getVenue().getCity();
            dto.venueCountry = event.getVenue().getCountry();

            dto.venueLatitude = event.getVenue().getLatitude();
            dto.venueLongitude = event.getVenue().getLongitude();

            // 🔥 YENİ
            dto.venueAddress = event.getVenue().getAddress();
            dto.venueImageUrl = event.getVenue().getImageUrl();
        } else {
            dto.venueLatitude = null;
            dto.venueLongitude = null;
        }

        // 👤 USER
        if (event.getCreatedBy() != null) {
            dto.createdByUserId = event.getCreatedBy().getId();
            dto.createdByUsername = event.getCreatedBy().getUsername();
        }

        return dto;
    }

    // GETTERS

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public LocalDateTime getEventDate() {
        return eventDate;
    }

    public Boolean getIsApproved() {
        return isApproved;
    }

    public Long getArtistId() {
        return artistId;
    }

    public String getArtistName() {
        return artistName;
    }

    public String getArtistImageUrl() {
        return artistImageUrl;
    }

    public String getArtistGenre() {
        return artistGenre;
    }

    public String getArtistSpotifyId() {
        return artistSpotifyId;
    }

    public Long getVenueId() {
        return venueId;
    }

    public String getVenueName() {
        return venueName;
    }

    public String getVenueCity() {
        return venueCity;
    }

    public String getVenueCountry() {
        return venueCountry;
    }

    public String getVenueAddress() {
        return venueAddress;
    }

    public String getVenueImageUrl() {
        return venueImageUrl;
    }

    public Double getVenueLatitude() {
        return venueLatitude;
    }

    public Double getVenueLongitude() {
        return venueLongitude;
    }

    public String getGenre() {
        return genre;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public String getTicketUrl() {
        return ticketUrl;
    }

    public Long getCreatedByUserId() {
        return createdByUserId;
    }

    public String getCreatedByUsername() {
        return createdByUsername;
    }
}