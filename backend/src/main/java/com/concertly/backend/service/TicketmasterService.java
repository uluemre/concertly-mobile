package com.concertly.backend.service;

import com.concertly.backend.model.Artist;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.Venue;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.VenueRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Service
public class TicketmasterService {

    @Value("${ticketmaster.api.key}")
    private String apiKey;

    private final EventRepository eventRepository;
    private final ArtistRepository artistRepository;
    private final VenueRepository venueRepository;
    private final RestTemplate restTemplate;

    public TicketmasterService(EventRepository eventRepository,
                               ArtistRepository artistRepository,
                               VenueRepository venueRepository) {
        this.eventRepository  = eventRepository;
        this.artistRepository = artistRepository;
        this.venueRepository  = venueRepository;
        this.restTemplate     = new RestTemplate();
    }

    public int syncTurkeyEvents() {
        String url = UriComponentsBuilder
                .fromHttpUrl("https://app.ticketmaster.com/discovery/v2/events.json")
                .queryParam("apikey", apiKey)
                .queryParam("countryCode", "TR")
                .queryParam("classificationName", "music")
                .queryParam("size", 50)
                .toUriString();

        Map response = restTemplate.getForObject(url, Map.class);
        if (response == null) return 0;

        Map embedded = (Map) response.get("_embedded");
        if (embedded == null) return 0;

        List<Map> events = (List<Map>) embedded.get("events");
        if (events == null) return 0;

        int count = 0;
        for (Map e : events) {
            try {
                String externalId = (String) e.get("id");

                // Zaten varsa atla
                if (eventRepository.findByExternalId(externalId).isPresent()) continue;

                String name = (String) e.get("name");

                // Tarih
                Map dates = (Map) e.get("dates");
                Map start = (Map) dates.get("start");
                String dateStr = (String) start.get("localDate");
                String timeStr = start.get("localTime") != null ? (String) start.get("localTime") : "20:00:00";
                LocalDateTime eventDate = LocalDateTime.parse(dateStr + "T" + timeStr);

                // Artist
                Artist artist = new Artist();
                List<Map> attractions = null;
                Map emb = (Map) e.get("_embedded");
                if (emb != null && emb.get("attractions") != null) {
                    attractions = (List<Map>) emb.get("attractions");
                    artist.setName((String) attractions.get(0).get("name"));
                    artist.setExternalId((String) attractions.get(0).get("id"));
                } else {
                    artist.setName(name);
                    artist.setExternalId(externalId + "_artist");
                }
                artist = artistRepository.save(artist);

                // Venue
                Venue venue = new Venue();
                if (emb != null && emb.get("venues") != null) {
                    List<Map> venues = (List<Map>) emb.get("venues");
                    Map v = venues.get(0);
                    venue.setName((String) v.get("name"));
                    venue.setCity(v.get("city") != null ? (String) ((Map) v.get("city")).get("name") : "TR");
                    venue.setCountry("Türkiye");
                    if (v.get("location") != null) {
                        Map loc = (Map) v.get("location");
                        venue.setLatitude(Double.parseDouble((String) loc.get("latitude")));
                        venue.setLongitude(Double.parseDouble((String) loc.get("longitude")));
                    }
                } else {
                    venue.setName("Bilinmiyor");
                    venue.setCity("TR");
                    venue.setCountry("Türkiye");
                }
                venue = venueRepository.save(venue);

                // Event
                Event event = new Event();
                event.setName(name);
                event.setDescription("Ticketmaster'dan alınan etkinlik");
                event.setEventDate(eventDate);
                event.setExternalId(externalId);
                event.setIsApproved(true);
                event.setArtist(artist);
                event.setVenue(venue);
                eventRepository.save(event);
                count++;

            } catch (Exception ex) {
                System.out.println("Event parse hatası: " + ex.getMessage());
            }
        }
        return count;
    }
}