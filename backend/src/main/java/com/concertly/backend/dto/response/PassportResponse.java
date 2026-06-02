package com.concertly.backend.dto.response;

import java.util.List;
import java.util.Map;

public class PassportResponse {

    private int totalConcerts;
    private int verifiedConcerts;
    private int uniqueArtists;
    private int uniqueCities;
    private Map<String, Long> concertsByYear;
    private List<PassportEventDto> events;

    public PassportResponse(int totalConcerts, int verifiedConcerts, int uniqueArtists,
                            int uniqueCities, Map<String, Long> concertsByYear,
                            List<PassportEventDto> events) {
        this.totalConcerts    = totalConcerts;
        this.verifiedConcerts = verifiedConcerts;
        this.uniqueArtists    = uniqueArtists;
        this.uniqueCities     = uniqueCities;
        this.concertsByYear   = concertsByYear;
        this.events           = events;
    }

    public int getTotalConcerts()                { return totalConcerts; }
    public int getVerifiedConcerts()             { return verifiedConcerts; }
    public int getUniqueArtists()                { return uniqueArtists; }
    public int getUniqueCities()                 { return uniqueCities; }
    public Map<String, Long> getConcertsByYear() { return concertsByYear; }
    public List<PassportEventDto> getEvents()    { return events; }

    // ── nested DTO ──────────────────────────────────────────────────────────
    public static class PassportEventDto {
        private Long   id;
        private String name;
        private String eventDate;
        private String artistName;
        private String venueCity;
        private String imageUrl;
        private String genre;
        private boolean verified;

        public PassportEventDto(Long id, String name, String eventDate, String artistName,
                                String venueCity, String imageUrl, String genre, boolean verified) {
            this.id         = id;
            this.name       = name;
            this.eventDate  = eventDate;
            this.artistName = artistName;
            this.venueCity  = venueCity;
            this.imageUrl   = imageUrl;
            this.genre      = genre;
            this.verified   = verified;
        }

        public Long    getId()         { return id; }
        public String  getName()       { return name; }
        public String  getEventDate()  { return eventDate; }
        public String  getArtistName() { return artistName; }
        public String  getVenueCity()  { return venueCity; }
        public String  getImageUrl()   { return imageUrl; }
        public String  getGenre()      { return genre; }
        public boolean isVerified()    { return verified; }
    }
}
