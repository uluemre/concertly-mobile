package com.concertly.backend.service;

import com.concertly.backend.dto.response.SearchResponse;
import com.concertly.backend.dto.response.VenueSummaryResponse;
import com.concertly.backend.model.Venue;
import com.concertly.backend.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** N-15: aramada mekanlar — yaklaşan etkinliği olan önce, en fazla 10. */
class SearchVenuesTest {

    private static Venue venue(long id, String name, String city) {
        Venue v = new Venue();
        ReflectionTestUtils.setField(v, "id", id);
        v.setName(name);
        v.setCity(city);
        return v;
    }

    private static SearchService service(VenueRepository venues, EventRepository events) {
        SearchService s = new SearchService(events, mock(ArtistRepository.class), mock(UserRepository.class),
                mock(ArtistFollowRepository.class), mock(PrivacyService.class));
        ReflectionTestUtils.setField(s, "venueRepository", venues);
        return s;
    }

    @Test
    void venuesWithUpcomingEventsComeFirst() {
        VenueRepository venues = mock(VenueRepository.class);
        EventRepository events = mock(EventRepository.class);
        when(venues.search("harbiye")).thenReturn(List.of(
                venue(1, "Harbiye Askeri Müze", "İstanbul"),
                venue(2, "Harbiye Cemil Topuzlu Açıkhava Tiyatrosu", "İstanbul"),
                venue(3, "Istanbul Kongre Merkezi, Harbiye Oditoryumu", "İstanbul")));
        List<Object[]> counts = new ArrayList<>();
        counts.add(new Object[]{2L, 12L});
        counts.add(new Object[]{3L, 4L});
        when(events.countUpcomingListedByVenueIdIn(anyCollection(), any())).thenReturn(counts);

        SearchResponse r = service(venues, events).search("harbiye", null);

        assertEquals(List.of(2L, 3L, 1L), r.getVenues().stream().map(VenueSummaryResponse::getId).toList());
        assertEquals("İstanbul", r.getVenues().get(0).getCity());
    }

    /** BUG-01: mekan adıyla kaydedilmiş "sanatçı" yalnızca Mekanlar'da görünür. */
    @Test
    void venueNamedArtistIsNotListedAsArtist() {
        VenueRepository venues = mock(VenueRepository.class);
        EventRepository events = mock(EventRepository.class);
        ArtistRepository artists = mock(ArtistRepository.class);
        when(venues.search("Oran AçıkHava")).thenReturn(List.of(
                venue(2809, "Oran Açıkhava", "Ankara"),
                venue(2357, "Oran Açık Hava Sahnesi", "Ankara")));
        when(events.countUpcomingListedByVenueIdIn(anyCollection(), any())).thenReturn(List.of());
        when(artists.search("Oran AçıkHava")).thenReturn(List.of(
                artist(10, "Oran AçıkHava"),          // aslında mekan
                artist(11, "Oran Açıkhava Gecesi")));  // gerçek sanatçı/etkinlik adı, kalır

        SearchService s = new SearchService(events, artists, mock(UserRepository.class),
                mock(ArtistFollowRepository.class), mock(PrivacyService.class));
        ReflectionTestUtils.setField(s, "venueRepository", venues);
        SearchResponse r = s.search("Oran AçıkHava", null);

        assertEquals(List.of(11L), r.getArtists().stream().map(a -> a.getId()).toList());
        // Mekanlar eskisi gibi listelenir (sıralama mevcut kural: etkinlik sayısı, sonra ad)
        assertEquals(List.of(2357L, 2809L), r.getVenues().stream().map(VenueSummaryResponse::getId).toList());
    }

    @Test
    void artistsUnchangedWhenNoVenueMatches() {
        ArtistRepository artists = mock(ArtistRepository.class);
        when(artists.search("hadise")).thenReturn(List.of(artist(1, "Hadise")));
        VenueRepository venues = mock(VenueRepository.class);
        when(venues.search("hadise")).thenReturn(List.of());
        SearchService s = new SearchService(mock(EventRepository.class), artists, mock(UserRepository.class),
                mock(ArtistFollowRepository.class), mock(PrivacyService.class));
        ReflectionTestUtils.setField(s, "venueRepository", venues);

        assertEquals(1, s.search("hadise", null).getArtists().size());
    }

    private static com.concertly.backend.model.Artist artist(long id, String name) {
        com.concertly.backend.model.Artist a = new com.concertly.backend.model.Artist();
        ReflectionTestUtils.setField(a, "id", id);
        a.setName(name);
        return a;
    }

    @Test
    void atMostTenVenuesAndShortQueriesReturnNothing() {
        VenueRepository venues = mock(VenueRepository.class);
        EventRepository events = mock(EventRepository.class);
        List<Venue> many = new ArrayList<>();
        for (long i = 1; i <= 15; i++) many.add(venue(i, "Açıkhava " + i, "Ankara"));
        when(venues.search("acikhava")).thenReturn(many);
        when(events.countUpcomingListedByVenueIdIn(anyCollection(), any())).thenReturn(List.of());

        SearchService s = service(venues, events);
        assertEquals(10, s.search("acikhava", null).getVenues().size());
        assertTrue(s.search("a", null).getVenues().isEmpty(), "2 karakterden kısa arama boş");
    }
}
