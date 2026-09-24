package com.concertly.backend.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Tür seçim ekranındaki adlar etkinlik türlerine çevrilmeli; yoksa öneri gelmiyordu. */
class GenreAliasTest {

    @Test
    void englishPickerNamesMapToEventGenres() {
        List<String> out = EventService.expandGenres(List.of("Electronic", "Classical", "Metal"));
        assertTrue(out.containsAll(List.of("electronic", "elektronik", "classical", "klasik", "metal", "rock")));
    }

    @Test
    void indieIsNotBrokenByTurkishLowercase() {
        List<String> out = EventService.expandGenres(List.of("Indie"));
        assertTrue(out.contains("indie"));
        assertTrue(out.contains("rock"));
        assertFalse(out.contains("ındie"));
    }

    @Test
    void plainGenresPassThroughWithoutDuplicates() {
        assertEquals(List.of("pop", "rock"), EventService.expandGenres(List.of("Pop", "Rock", "pop", " ")));
    }
}
