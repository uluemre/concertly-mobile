package com.concertly.backend.dto.response;

import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventSourceLink;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Mobil uygulamaya sunulan konser kaydi.
 *
 * Kaynak bilgisi (source, sourceUrl, externalId) BILEREK yok: mobil tarafin
 * verinin Ticketmaster'dan mi Biletinial'den mi geldigini bilmesine gerek
 * yok ve bilmemeli. Akis tek yonlu: kaynaklar -> backend -> veritabani ->
 * bu API -> uygulama.
 */
public class ConcertResponse {

    private Long id;
    private String name;
    private LocalDateTime eventDate;
    private String genre;
    private String imageUrl;
    private String ticketUrl;
    /** Kaynagi dogrulanmis etkinlik rozeti (bilet platformu ya da admin incelemesi). */
    private Boolean isVerified;

    private Long artistId;
    private String artistName;
    private String artistImageUrl;

    private Long venueId;
    private String venueName;
    private String venueCity;
    private String venueAddress;
    private Double venueLatitude;
    private Double venueLongitude;

    /**
     * Bu konserin bilet alinabilecek adresleri.
     *
     * Ayni konser birden fazla bilet sitesinde olabiliyor. Etiket, adresin
     * host'undan turetilir; ic kaynak adlari (EventSource enum) API'ye
     * sizdirilmaz. Birincil adres her zaman ilk siradadir.
     */
    private List<TicketLink> ticketLinks = List.of();

    /** Kullaniciya gosterilecek bilet baglantisi. */
    public record TicketLink(String label, String url) {}

    public static ConcertResponse from(Event event) {
        return from(event, List.of());
    }

    public static ConcertResponse from(Event event, List<EventSourceLink> sourceLinks) {
        ConcertResponse dto = new ConcertResponse();
        dto.id = event.getId();
        dto.name = event.getName();
        dto.eventDate = event.getEventDate();
        dto.genre = event.getGenre();
        dto.imageUrl = event.getImageUrl();
        dto.ticketUrl = event.getTicketUrl();
        dto.isVerified = event.getIsVerified();

        if (event.getArtist() != null) {
            dto.artistId = event.getArtist().getId();
            dto.artistName = event.getArtist().getName();
            dto.artistImageUrl = event.getArtist().getImageUrl();
        }
        if (event.getVenue() != null) {
            dto.venueId = event.getVenue().getId();
            dto.venueName = event.getVenue().getName();
            dto.venueCity = event.getVenue().getCity();
            dto.venueAddress = event.getVenue().getAddress();
            dto.venueLatitude = event.getVenue().getLatitude();
            dto.venueLongitude = event.getVenue().getLongitude();
        }
        dto.ticketLinks = buildTicketLinks(event, sourceLinks);
        return dto;
    }

    /**
     * Etkinligin kendi bilet adresi once, ardindan diger kaynaklarinki.
     * Ayni adres iki kez listelenmez.
     */
    static List<TicketLink> buildTicketLinks(Event event, List<EventSourceLink> sourceLinks) {
        Map<String, TicketLink> byUrl = new LinkedHashMap<>();
        addLink(byUrl, event.getTicketUrl());
        if (sourceLinks != null) {
            for (EventSourceLink link : sourceLinks) {
                addLink(byUrl, link.getTicketUrl());
            }
        }
        return new ArrayList<>(byUrl.values());
    }

    private static void addLink(Map<String, TicketLink> byUrl, String url) {
        if (url == null || url.isBlank()) return;
        String key = url.trim();
        if (byUrl.containsKey(key)) return;
        byUrl.put(key, new TicketLink(labelFor(key), key));
    }

    /**
     * Adresin host'undan okunabilir site adi uretir.
     *
     * Ic kaynak adini (TICKETMASTER/BILETINIAL) kullanmiyoruz: kullanicinin
     * gordugu sey mimari degil, bileti hangi siteden alacagi. Ticketmaster
     * Turkiye biletleri zaten biletix.com uzerinden satiliyor.
     */
    static String labelFor(String url) {
        String host = hostOf(url);
        if (host == null) return "Bilet al";
        return switch (host) {
            case "biletix.com" -> "Biletix";
            case "biletinial.com" -> "Biletinial";
            case "bubilet.com.tr" -> "Bubilet";
            case "mobilet.com" -> "Mobilet";
            case "passo.com.tr" -> "Passo";
            case "iticket.com.tr" -> "iTicket";
            case "ticketmaster.com" -> "Ticketmaster";
            default -> capitalize(host.split("\\.")[0]);
        };
    }

    private static String hostOf(String url) {
        try {
            String host = java.net.URI.create(url).getHost();
            if (host == null) return null;
            host = host.toLowerCase(Locale.ROOT);
            return host.startsWith("www.") ? host.substring(4) : host;
        } catch (Exception e) {
            return null;
        }
    }

    private static String capitalize(String value) {
        if (value == null || value.isEmpty()) return "Bilet al";
        return value.substring(0, 1).toUpperCase(Locale.ROOT) + value.substring(1);
    }

    public List<TicketLink> getTicketLinks() { return ticketLinks; }

    public Long getId() { return id; }
    public String getName() { return name; }
    public LocalDateTime getEventDate() { return eventDate; }
    public String getGenre() { return genre; }
    public String getImageUrl() { return imageUrl; }
    public String getTicketUrl() { return ticketUrl; }
    public Boolean getIsVerified() { return isVerified; }
    public Long getArtistId() { return artistId; }
    public String getArtistName() { return artistName; }
    public String getArtistImageUrl() { return artistImageUrl; }
    public Long getVenueId() { return venueId; }
    public String getVenueName() { return venueName; }
    public String getVenueCity() { return venueCity; }
    public String getVenueAddress() { return venueAddress; }
    public Double getVenueLatitude() { return venueLatitude; }
    public Double getVenueLongitude() { return venueLongitude; }
}
