package com.concertly.backend.dto.response;

import com.concertly.backend.model.Venue;

public class VenueDetailResponse {
    private Long id;
    private String name;
    private String city;
    private String country;
    private String address;
    private String imageUrl;
    private Double latitude;
    private Double longitude;
    private Double avgRating;
    private long reviewCount;
    private long totalEvents;
    private Integer myRating;

    public static VenueDetailResponse from(Venue v, Double avgRating, long reviewCount, long totalEvents, Integer myRating) {
        VenueDetailResponse r = new VenueDetailResponse();
        r.id = v.getId();
        r.name = v.getName();
        r.city = v.getCity();
        r.country = v.getCountry();
        r.address = v.getAddress();
        r.imageUrl = v.getImageUrl();
        r.latitude = v.getLatitude();
        r.longitude = v.getLongitude();
        r.avgRating = avgRating != null ? Math.round(avgRating * 10.0) / 10.0 : 0.0;
        r.reviewCount = reviewCount;
        r.totalEvents = totalEvents;
        r.myRating = myRating;
        return r;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getCity() { return city; }
    public String getCountry() { return country; }
    public String getAddress() { return address; }
    public String getImageUrl() { return imageUrl; }
    public Double getLatitude() { return latitude; }
    public Double getLongitude() { return longitude; }
    public Double getAvgRating() { return avgRating; }
    public long getReviewCount() { return reviewCount; }
    public long getTotalEvents() { return totalEvents; }
    public Integer getMyRating() { return myRating; }
}
