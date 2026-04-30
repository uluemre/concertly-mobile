package com.concertly.backend.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "events")
public class Event {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    private String description;

    private LocalDateTime eventDate;

    private String externalId;

    private Boolean isApproved = false;

    @ManyToOne
    @JoinColumn(name = "artist_id")
    private Artist artist;

    @ManyToOne
    @JoinColumn(name = "venue_id")
    private Venue venue;

    @ManyToOne
    @JoinColumn(name = "created_by_user_id", nullable = true)  // ✅ nullable
    private User createdBy;

    public Long getId()                        { return id; }

    public String getName()                    { return name; }
    public void setName(String name)           { this.name = name; }

    public String getDescription()             { return description; }
    public void setDescription(String desc)    { this.description = desc; }

    public LocalDateTime getEventDate()        { return eventDate; }
    public void setEventDate(LocalDateTime d)  { this.eventDate = d; }

    public String getExternalId()              { return externalId; }
    public void setExternalId(String id)       { this.externalId = id; }

    public Boolean getIsApproved()             { return isApproved; }
    public void setIsApproved(Boolean val)     { this.isApproved = val; }

    public Artist getArtist()                  { return artist; }
    public void setArtist(Artist artist)       { this.artist = artist; }

    public Venue getVenue()                    { return venue; }
    public void setVenue(Venue venue)          { this.venue = venue; }

    public User getCreatedBy()                 { return createdBy; }
    public void setCreatedBy(User user)        { this.createdBy = user; }
}