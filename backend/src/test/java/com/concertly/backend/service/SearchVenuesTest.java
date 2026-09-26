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
                mock(ArtistFollowRepository.class));
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
