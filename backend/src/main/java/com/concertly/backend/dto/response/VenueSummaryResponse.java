package com.concertly.backend.dto.response;

import com.concertly.backend.model.Venue;

/** Arama sonucundaki mekan satırı — mekan sayfasını açmak için yeterli bilgi. */
public class VenueSummaryResponse {
    private Long id;
    private String name;
    private String city;

    public static VenueSummaryResponse from(Venue venue) {
        VenueSummaryResponse dto = new VenueSummaryResponse();
        dto.id = venue.getId();
        dto.name = venue.getName();
        dto.city = venue.getCity();
        return dto;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getCity() { return city; }
}
