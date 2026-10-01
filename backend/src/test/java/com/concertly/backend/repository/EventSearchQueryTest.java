package com.concertly.backend.repository;

import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Query;

import static org.junit.jupiter.api.Assertions.*;

/**
 * BUG-01 (etkinlikler): "Oran AçıkHava" gibi bir mekan adı arandığında etkinlik sonucu
 * yalnızca mekan adı yüzünden üretilmemeli (mekan, aramanın "Mekanlar" bölümünde döner).
 * Etkinlik adı, sanatçı adı ve şehir eşleşmesi eskisi gibi kalmalı.
 */
class EventSearchQueryTest {

    private static String searchJpql() throws NoSuchMethodException {
        return EventRepository.class.getMethod("searchByPattern", String.class)
                .getAnnotation(Query.class).value();
    }

    @Test
    void venueNameIsNotAnEventSearchField() throws Exception {
        assertFalse(searchJpql().contains("e.venue.name"),
                "mekan adı etkinlik aramasında eşleşme alanı olmamalı");
    }

    @Test
    void eventNameArtistAndCityStillSearchedWithEscape() throws Exception {
        String q = searchJpql();
        assertTrue(q.contains("e.name"), "adı 'Oran AçıkHava' olan gerçek etkinlik bulunmaya devam etmeli");
        assertTrue(q.contains("e.artist.name"));
        assertTrue(q.contains("e.venue.city"));
        assertEquals(3, q.split("ESCAPE '!'", -1).length - 1, "her alan joker-kaçışlı aranır");
    }
}
