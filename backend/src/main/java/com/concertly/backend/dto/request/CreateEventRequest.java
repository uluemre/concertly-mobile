package com.concertly.backend.dto.request;

import java.time.LocalDateTime;

public class CreateEventRequest {

    private String name;
    private String description;
    private LocalDateTime eventDate;
    private Long artistId;
    private Long venueId;
    private Long createdByUserId;

    // Venue inline (venueId yoksa bunlar kullanılır)
    private String venueName;
    private String venueCity;
    private String venueCountry;
    private String venueAddress;
    private Double venueLatitude;
    private Double venueLongitude;

    // Artist inline (artistId yoksa bunlar kullanılır)
    private String artistName;
    private String artistGenre;
    private String ticketUrl;

    public String getName()                    { return name; }
    public String getDescription()             { return description; }
    public LocalDateTime getEventDate()        { return eventDate; }
    public Long getArtistId()                  { return artistId; }
    public Long getVenueId()                   { return venueId; }
    public Long getCreatedByUserId()           { return createdByUserId; }
    public String getVenueName()               { return venueName; }
    public String getVenueCity()               { return venueCity; }
    public String getVenueCountry()            { return venueCountry; }
    public String getVenueAddress()            { return venueAddress; }
    public Double getVenueLatitude()           { return venueLatitude; }
    public Double getVenueLongitude()          { return venueLongitude; }
    public String getArtistName()              { return artistName; }
    public String getArtistGenre()             { return artistGenre; }
    public String getTicketUrl()               { return ticketUrl; }

    public void setName(String name)                        { this.name = name; }
    public void setDescription(String description)          { this.description = description; }
    public void setEventDate(LocalDateTime eventDate)       { this.eventDate = eventDate; }
    public void setArtistId(Long artistId)                  { this.artistId = artistId; }
    public void setVenueId(Long venueId)                    { this.venueId = venueId; }
    public void setCreatedByUserId(Long createdByUserId)    { this.createdByUserId = createdByUserId; }
    public void setVenueName(String venueName)              { this.venueName = venueName; }
    public void setVenueCity(String venueCity)              { this.venueCity = venueCity; }
    public void setVenueCountry(String venueCountry)        { this.venueCountry = venueCountry; }
    public void setVenueAddress(String venueAddress)        { this.venueAddress = venueAddress; }
    public void setVenueLatitude(Double venueLatitude)      { this.venueLatitude = venueLatitude; }
    public void setVenueLongitude(Double venueLongitude)    { this.venueLongitude = venueLongitude; }
    public void setArtistName(String artistName)            { this.artistName = artistName; }
    public void setArtistGenre(String artistGenre)          { this.artistGenre = artistGenre; }
    public void setTicketUrl(String ticketUrl)              { this.ticketUrl = ticketUrl; }
}