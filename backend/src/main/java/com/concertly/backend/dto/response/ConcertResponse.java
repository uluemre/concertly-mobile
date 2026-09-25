package com.concertly.backend.dto.response;

import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventSourceLink;
import com.concertly.backend.model.ImageUrls;

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
        dto.imageUrl = ImageUrls.usable(event.getImageUrl());
        dto.ticketUrl = event.getTicketUrl();
        dto.isVerified = event.getIsVerified();

        if (event.getArtist() != null) {
            dto.artistId = event.getArtist().getId();
            dto.artistName = event.getArtist().getName();
            dto.artistImageUrl = ImageUrls.usable(event.getArtist().getImageUrl());
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
     * Ayni konserin birden fazla kaydini (orn. Ticketmaster + Biletinial ya da
     * Ticketmaster'in ayni konser icin actigi ikinci kimlik) TEK kart olarak
     * sunar. Veri degismez; yalnizca cevap birlestirilir.
     *
     * @param canonical listede gosterilecek kayit (merge kuralindaki asil kayit)
     * @param members   grubun tum kayitlari, canonical dahil
     * @param links     gruptaki kayitlarin kaynak satirlari
     */
    public static ConcertResponse fromGroup(Event canonical, List<Event> members, List<EventSourceLink> links) {
        ConcertResponse dto = from(canonical, List.of());
        List<Event> ordered = new ArrayList<>();
        ordered.add(canonical);
        for (Event m : members) if (m != canonical) ordered.add(m);

        dto.ticketLinks = resolveTicketLinks(ordered, links);
        dto.ticketUrl = dto.ticketLinks.isEmpty() ? null : dto.ticketLinks.get(0).url();
        for (Event m : ordered) {
            if (dto.imageUrl == null) dto.imageUrl = ImageUrls.usable(m.getImageUrl());
            if (dto.genre == null || dto.genre.isBlank()) dto.genre = m.getGenre();
        }
        return dto;
    }

    /** Bir kaynagin satiri, gruptaki en taze satirdan bu kadar gun geride kaldiysa bayat sayilir. */
    static final long STALE_LINK_DAYS = 3;

    /**
     * Grubun bilet adresleri: asil kayit once, her kaydin kendi adresi ve kaynak
     * satirlari. Bir kaynak gece senkronunda artik gorulmuyorsa (last_seen_at
     * digerlerinin gerisinde kaldiysa) adresi eskimis olabilir; gosterilmez.
     * Karsilastirma goreli: sunucu birkac gun uyusa bile tum adresler birden
     * elenmez.
     */
    public static List<TicketLink> resolveTicketLinks(List<Event> events, List<EventSourceLink> links) {
        List<EventSourceLink> all = links == null ? List.of() : links;
        LocalDateTime newest = all.stream().map(EventSourceLink::getLastSeenAt)
                .filter(java.util.Objects::nonNull).max(LocalDateTime::compareTo).orElse(null);
        java.util.Set<String> stale = new java.util.HashSet<>();
        java.util.Set<String> fresh = new java.util.HashSet<>();
        for (EventSourceLink l : all) {
            if (l.getTicketUrl() == null || l.getTicketUrl().isBlank()) continue;
            boolean isStale = newest != null && l.getLastSeenAt() != null
                    && l.getLastSeenAt().isBefore(newest.minusDays(STALE_LINK_DAYS));
            (isStale ? stale : fresh).add(l.getTicketUrl().trim());
        }

        Map<String, TicketLink> byUrl = new LinkedHashMap<>();
        for (Event e : events) {
            String own = e.getTicketUrl() == null ? null : e.getTicketUrl().trim();
            if (own != null && !(stale.contains(own) && !fresh.contains(own))) addLink(byUrl, own);
            all.stream()
                    .filter(l -> l.getEvent() != null && e.getId() != null && e.getId().equals(l.getEvent().getId()))
                    .sorted(java.util.Comparator.comparing(l -> !l.getIsPrimary()))
                    .forEach(l -> {
                        String url = l.getTicketUrl() == null ? null : l.getTicketUrl().trim();
                        if (url != null && fresh.contains(url)) addLink(byUrl, url);
                    });
        }
        // Site basina tek secenek: Ticketmaster ayni konseri birden fazla kimlikle
        // acabiliyor; kullaniciya uc ayri "Biletix" gostermeyiz. Ilk adres (asil
        // kaydinki) kalir.
        Map<String, TicketLink> bySite = new LinkedHashMap<>();
        for (TicketLink l : byUrl.values()) bySite.putIfAbsent(l.label(), l);
        return new ArrayList<>(bySite.values());
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
