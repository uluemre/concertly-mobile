package com.concertly.backend.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Mesafe hesabı doğrulamanın tek güvenlik sınırı olduğu için bilinen
 * koordinatlarla ölçülür.
 */
class EventVerificationServiceTest {

    // Volkswagen Arena, İstanbul
    private static final double VENUE_LAT = 41.1103;
    private static final double VENUE_LNG = 29.0169;

    @Test
    void aynıNoktadaMesafeSıfır() {
        double d = EventVerificationService.distanceInMeters(
                VENUE_LAT, VENUE_LNG, VENUE_LAT, VENUE_LNG);
        assertEquals(0.0, d, 0.001);
    }

    @Test
    void mekanınHemenYanındaSınırınAltında() {
        // ~0.001 derece enlem ≈ 111 m
        double d = EventVerificationService.distanceInMeters(
                VENUE_LAT + 0.001, VENUE_LNG, VENUE_LAT, VENUE_LNG);
        assertTrue(d > 100 && d < 125, "beklenen ~111 m, gelen: " + d);
        assertTrue(d < 500, "varsayılan 500 m sınırının altında olmalı");
    }

    @Test
    void başkaŞehirdenSınırınÇokÜstünde() {
        // Ankara Kızılay — İstanbul'daki mekandan ~350 km
        double d = EventVerificationService.distanceInMeters(
                39.9208, 32.8541, VENUE_LAT, VENUE_LNG);
        assertTrue(d > 300_000, "beklenen >300 km, gelen: " + d);
    }

    @Test
    void bilinenMesafeyeYakınsıyor() {
        // İstanbul Taksim -> Kadıköy, kuş uçuşu ~5.5 km
        double d = EventVerificationService.distanceInMeters(
                41.0370, 28.9850, 40.9900, 29.0250);
        assertTrue(d > 5_000 && d < 6_500, "beklenen ~5.5 km, gelen: " + d);
    }

    @Test
    void ekvatorBoyuncaBirDereceBoylamYaklaşık111Km() {
        double d = EventVerificationService.distanceInMeters(0, 0, 0, 1);
        assertTrue(d > 111_000 && d < 111_500, "beklenen ~111.3 km, gelen: " + d);
    }
}
