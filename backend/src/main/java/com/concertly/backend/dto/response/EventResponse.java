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

    // Venue bilgileri
    private Long venueId;
    private String venueName;
    private String venueCity;
    private String venueCountry;

    // 🔥 YENİ EKLENENLER
    private Double venueLatitude;
    private Double venueLongitude;

    // Oluşturan kullanıcı
    private Long createdByUserId;
    private String createdByUsername;

    public static EventResponse from(Event event) {
        EventResponse dto = new EventResponse();
        dto.id          = event.getId();
        dto.name        = event.getName();
        dto.description = event.getDescription();
        dto.eventDate   = event.getEventDate();
        dto.isApproved  = event.getIsApproved();

        if (event.getArtist() != null) {
            dto.artistId       = event.getArtist().getId();
            dto.artistName     = event.getArtist().getName();
            dto.artistImageUrl = event.getArtist().getImageUrl();
        }

        if (event.getVenue() != null) {
            dto.venueId      = event.getVenue().getId();
            dto.venueName    = event.getVenue().getName();
            dto.venueCity    = event.getVenue().getCity();
            dto.venueCountry = event.getVenue().getCountry();

            // 🔥 YENİ EKLENENLER
            dto.venueLatitude  = event.getVenue().getLatitude();
            dto.venueLongitude = event.getVenue().getLongitude();
        } else {
            dto.venueLatitude  = null;
            dto.venueLongitude = null;
        }

        if (event.getCreatedBy() != null) {
            dto.createdByUserId  = event.getCreatedBy().getId();
            dto.createdByUsername = event.getCreatedBy().getUsername();
        }

        return dto;
    }

    public Long getId()                  { return id; }
    public String getName()              { return name; }
    public String getDescription()       { return description; }
    public LocalDateTime getEventDate()  { return eventDate; }
    public Boolean getIsApproved()       { return isApproved; }
    public Long getArtistId()            { return artistId; }
    public String getArtistName()        { return artistName; }
    public String getArtistImageUrl()    { return artistImageUrl; }
    public Long getVenueId()             { return venueId; }
    public String getVenueName()         { return venueName; }
    public String getVenueCity()         { return venueCity; }
    public String getVenueCountry()      { return venueCountry; }

    // 🔥 YENİ GETTER'LAR
    public Double getVenueLatitude()     { return venueLatitude; }
    public Double getVenueLongitude()   { return venueLongitude; }

    public Long getCreatedByUserId()     { return createdByUserId; }
    public String getCreatedByUsername() { return createdByUsername; }
}