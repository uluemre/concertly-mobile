package com.concertly.backend.service;

import com.concertly.backend.dto.response.*;
import com.concertly.backend.repository.*;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SearchService {

    private final EventRepository eventRepository;
    private final ArtistRepository artistRepository;
    private final UserRepository userRepository;
    private final ArtistFollowRepository artistFollowRepository;

    // Mekan araması (N-15). Alan enjeksiyonu: kurucu ve onu kullanan testler degismesin.
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private VenueRepository venueRepository;

    /** Aramada gösterilen en fazla mekan sayısı. */
    static final int MAX_VENUES = 10;

    public SearchService(EventRepository eventRepository,
            ArtistRepository artistRepository,
            UserRepository userRepository,
            ArtistFollowRepository artistFollowRepository) {
        this.eventRepository = eventRepository;
        this.artistRepository = artistRepository;
        this.userRepository = userRepository;
        this.artistFollowRepository = artistFollowRepository;
    }

    /**
     * Adı aramayla eşleşen mekanlar: yaklaşan etkinliği olanlar önce (çok olan üstte),
     * sonra ada göre. Sayı yalnızca sıralama için; kopya kayıtları da saydığından gösterilmez.
     */
    private List<VenueSummaryResponse> searchVenues(String query) {
        if (venueRepository == null) return List.of();
        List<com.concertly.backend.model.Venue> venues = venueRepository.search(query);
        if (venues.isEmpty()) return List.of();
        java.util.Map<Long, Long> upcoming = new java.util.HashMap<>();
        for (Object[] row : eventRepository.countUpcomingListedByVenueIdIn(
                venues.stream().map(com.concertly.backend.model.Venue::getId).toList(),
                java.time.LocalDateTime.now())) {
            upcoming.put((Long) row[0], (Long) row[1]);
        }
        return venues.stream()
                .sorted(java.util.Comparator.<com.concertly.backend.model.Venue>comparingLong(
                                v -> upcoming.getOrDefault(v.getId(), 0L)).reversed()
                        .thenComparing(com.concertly.backend.model.Venue::getName,
                                java.util.Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                        .thenComparing(com.concertly.backend.model.Venue::getId))
                .limit(MAX_VENUES)
                .map(VenueSummaryResponse::from)
                .toList();
    }

    // Ayni konserin kopyalari (Biletix + Biletinial...) listede tek kart olsun.
    // Alan enjeksiyonu: kurucu ve onu kullanan testler degismesin; yoksa liste aynen doner.
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.concertly.backend.service.ingest.ConcertGrouping concertGrouping;

    private List<com.concertly.backend.model.Event> collapseCopies(List<com.concertly.backend.model.Event> events) {
        return concertGrouping == null ? events : concertGrouping.collapse(events);
    }

    public SearchResponse search(String q, Long currentUserId) {
        if (q == null || q.trim().length() < 2) {
            return new SearchResponse(List.of(), List.of(), List.of());
        }

        String query = q.trim();

        // Yaklaşanlar önce (en yakın üstte), sonra geçmişler (en yeni üstte) — sanatçı sayfasıyla
        // aynı kural. Eskiden yalnızca tarihe göre azalandı: geçmiş ve yaklaşan karışık geliyordu.
        List<EventResponse> events = collapseCopies(eventRepository.search(query)
                .stream()
                .filter(com.concertly.backend.model.Event::listedPublicly)
                .toList())
                .stream()
                .sorted(EventOrder.nearestFirst(java.time.LocalDateTime.now()))
                .map(EventResponse::from)
                .toList();

        List<ArtistResponse> artists = artistRepository.search(query)
                .stream()
                .map(a -> {
                    long followerCount = artistFollowRepository.countByArtistId(a.getId());
                    boolean isFollowed = currentUserId != null &&
                            artistFollowRepository.findByUserIdAndArtistId(currentUserId, a.getId()).isPresent();
                    return ArtistResponse.from(a, followerCount, isFollowed);
                })
                .toList();

        // E-posta dönülmez (gizlilik) — arama sonucunda alt satır olarak şehir gösterilir
        List<UserResponse> users = userRepository.search(query)
                .stream()
                .map(u -> new UserResponse(u.getId(), u.getUsername(), null, u.getCity()))
                .toList();

        return new SearchResponse(events, artists, users, searchVenues(query));
    }
}