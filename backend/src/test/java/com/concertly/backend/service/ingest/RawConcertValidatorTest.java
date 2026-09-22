package com.concertly.backend.service.ingest;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

/** Cop verinin veritabanina girmesini engelleyen temel dogrulama. */
class RawConcertValidatorTest {

    private final RawConcertValidator validator = new RawConcertValidator();

    private RawConcertData raw(String name, LocalDateTime date, String venue, Double lat, Double lon) {
        return new RawConcertData("BILETINIAL", "slug@" + date, "Sanatci", name, date,
                venue, "adres", "Ankara", lat, lon, "https://ornek/bilet", null);
    }

    @Test
    void acceptsPlausibleRecord() {
        assertNull(validator.validate(
                raw("Konser", LocalDateTime.now().plusDays(30), "Sahne", 39.9, 32.8)));
    }

    @Test
    void rejectsPastEvent() {
        assertEquals("gecmis tarihli",
                validator.validate(raw("Konser", LocalDateTime.now().minusDays(10), "Sahne", 39.9, 32.8)));
    }

    /** Bugunku konser hala gecerli olmali: gun icinde senkron calisabilir. */
    @Test
    void acceptsEventLaterToday() {
        assertNull(validator.validate(
                raw("Konser", LocalDateTime.now().plusHours(3), "Sahne", 39.9, 32.8)));
    }

    @Test
    void rejectsAbsurdFutureDate() {
        assertEquals("makul olmayan ileri tarih",
                validator.validate(raw("Konser", LocalDateTime.now().plusYears(5), "Sahne", 39.9, 32.8)));
    }

    @Test
    void rejectsMissingVenue() {
        assertEquals("zorunlu alan eksik (ad/tarih/mekan)",
                validator.validate(raw("Konser", LocalDateTime.now().plusDays(5), null, 39.9, 32.8)));
    }

    @Test
    void rejectsOutOfRangeCoordinates() {
        assertEquals("enlem araligi disinda",
                validator.validate(raw("Konser", LocalDateTime.now().plusDays(5), "Sahne", 120.0, 32.8)));
        assertEquals("boylam araligi disinda",
                validator.validate(raw("Konser", LocalDateTime.now().plusDays(5), "Sahne", 39.9, 250.0)));
    }

    @Test
    void acceptsMissingCoordinates() {
        assertNull(validator.validate(
                raw("Konser", LocalDateTime.now().plusDays(5), "Sahne", null, null)));
    }
}
