package com.concertly.backend.dto.response;

import java.util.List;
import java.util.Map;
import java.util.Set;

public class PassportResponse {

    private int totalConcerts;
    private int verifiedConcerts;
    private int uniqueArtists;
    private int uniqueCities;
    private Map<String, Long> concertsByYear;
    private List<PassportEventDto> events;
    private Set<Long> bingoEventIds;
    private List<BadgeResponse> badges;
    private List<TopArtistDto> topArtists;
    private List<TopGenreDto> topGenres;

    public PassportResponse(int totalConcerts, int verifiedConcerts, int uniqueArtists,
                            int uniqueCities, Map<String, Long> concertsByYear,
                            List<PassportEventDto> events, Set<Long> bingoEventIds,
                            List<BadgeResponse> badges,
                            List<TopArtistDto> topArtists,
                            List<TopGenreDto> topGenres) {
        this.totalConcerts    = totalConcerts;
        this.verifiedConcerts = verifiedConcerts;
        this.uniqueArtists    = uniqueArtists;
        this.uniqueCities     = uniqueCities;
        this.concertsByYear   = concertsByYear;
        this.events           = events;
        this.bingoEventIds    = bingoEventIds;
        this.badges           = badges;
        this.topArtists       = topArtists;
        this.topGenres        = topGenres;
    }

    public int getTotalConcerts()                { return totalConcerts; }
    public int getVerifiedConcerts()             { return verifiedConcerts; }
    public int getUniqueArtists()                { return uniqueArtists; }
    public int getUniqueCities()                 { return uniqueCities; }
    public Map<String, Long> getConcertsByYear() { return concertsByYear; }
    public List<PassportEventDto> getEvents()    { return events; }
    public Set<Long> getBingoEventIds()          { return bingoEventIds; }
    public List<BadgeResponse> getBadges()       { return badges; }
    public List<TopArtistDto> getTopArtists()    { return topArtists; }
    public List<TopGenreDto> getTopGenres()      { return topGenres; }

    // ── Nested DTOs ─────────────────────────────────────────────────────────

    public static class PassportEventDto {
        private Long   id;
        private String name;
        private String eventDate;
        private Long   artistId;
        private String artistName;
        private String venueCity;
        private String imageUrl;
        private String genre;
        private boolean verified;

        public PassportEventDto(Long id, String name, String eventDate,
                                Long artistId, String artistName,
                                String venueCity, String imageUrl, String genre, boolean verified) {
            this.id         = id;
            this.name       = name;
            this.eventDate  = eventDate;
            this.artistId   = artistId;
            this.artistName = artistName;
            this.venueCity  = venueCity;
            this.imageUrl   = imageUrl;
            this.genre      = genre;
            this.verified   = verified;
        }

        public Long    getId()         { return id; }
        public String  getName()       { return name; }
        public String  getEventDate()  { return eventDate; }
        public Long    getArtistId()   { return artistId; }
        public String  getArtistName() { return artistName; }
        public String  getVenueCity()  { return venueCity; }
        public String  getImageUrl()   { return imageUrl; }
        public String  getGenre()      { return genre; }
        public boolean isVerified()    { return verified; }
    }

    public static class TopArtistDto {
        private String name;
        private int count;

        public TopArtistDto(String name, int count) {
            this.name  = name;
            this.count = count;
        }

        public String getName()  { return name; }
        public int    getCount() { return count; }
    }

    public static class TopGenreDto {
        private String genre;
        private int count;

        public TopGenreDto(String genre, int count) {
            this.genre = genre;
            this.count = count;
        }

        public String getGenre() { return genre; }
        public int    getCount() { return count; }
    }
}
