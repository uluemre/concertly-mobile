package com.concertly.backend.model;

import com.concertly.backend.dto.response.VenueDetailResponse;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** BUG-02: mekan detay haritası koordinatları /venues/{id} yanıtından okur. */
class VenueDetailCoordinatesTest {

    @Test
    void detailResponseCarriesVenueCoordinatesAndAddress() {
        Venue v = new Venue();
        v.setName("Oran Açık Hava Sahnesi");
        v.setAddress("Oran, Çankaya");
        v.setLatitude(39.848307);
        v.setLongitude(32.832775);

        VenueDetailResponse r = VenueDetailResponse.from(v, 0.0, 0, 0, null);

        assertEquals(39.848307, r.getLatitude());
        assertEquals(32.832775, r.getLongitude());
        assertEquals("Oran, Çankaya", r.getAddress());
    }

    @Test
    void missingCoordinatesStayNull() {
        Venue v = new Venue();
        v.setName("Oran Açıkhava");

        VenueDetailResponse r = VenueDetailResponse.from(v, 0.0, 0, 0, null);

        assertNull(r.getLatitude());
        assertNull(r.getLongitude());
    }
}
