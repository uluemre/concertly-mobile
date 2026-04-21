package com.concertly.backend.dto.request;

import java.time.LocalDateTime;

public class CreateEventRequest {

    private String name;
    private String description;
    private LocalDateTime eventDate;
    private Long artistId;
    private Long venueId;
    private Long createdByUserId;

    public String getName()                    { return name; }
    public String getDescription()             { return description; }
    public LocalDateTime getEventDate()        { return eventDate; }
    public Long getArtistId()                  { return artistId; }
    public Long getVenueId()                   { return venueId; }
    public Long getCreatedByUserId()           { return createdByUserId; }

    public void setName(String name)                        { this.name = name; }
    public void setDescription(String description)          { this.description = description; }
    public void setEventDate(LocalDateTime eventDate)       { this.eventDate = eventDate; }
    public void setArtistId(Long artistId)                  { this.artistId = artistId; }
    public void setVenueId(Long venueId)                    { this.venueId = venueId; }
    public void setCreatedByUserId(Long createdByUserId)    { this.createdByUserId = createdByUserId; }
}