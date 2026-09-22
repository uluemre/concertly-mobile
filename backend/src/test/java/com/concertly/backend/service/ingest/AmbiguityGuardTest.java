package com.concertly.backend.service.ingest;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Belirsizlik korumasi.
 *
 * Gercek veride yakalandi: Harbiye'de birbirine 91 m uzaklikta iki AYRI salon
 * var ve ayni sanatci ayni saatte ikisiyle birden "guclu" eslesiyordu. En fazla
 * biri dogru olabilecegi icin hicbirini otomatik birlestirmeye birakmiyoruz.
 */
class AmbiguityGuardTest {

    private static CrossSourceDuplicateReport.Candidate candidate(
            long biletinialId, long otherId, EventMatcher.Confidence confidence) {
        return new CrossSourceDuplicateReport.Candidate(
                biletinialId, otherId, "Sami Yusuf", "İstanbul",
                LocalDateTime.parse("2026-09-27T21:00"), LocalDateTime.parse("2026-09-27T21:00"),
                "Salon A", "Salon B", "tm-id", confidence, "gerekce");
    }

    @Test
    void singleStrongCandidateStaysStrong() {
        List<CrossSourceDuplicateReport.Candidate> result =
                CrossSourceDuplicateReport.applyAmbiguityGuard(
                        List.of(candidate(9429, 8699, EventMatcher.Confidence.STRONG)));

        assertEquals(EventMatcher.Confidence.STRONG, result.get(0).confidence());
    }

    @Test
    void multipleStrongCandidatesAreAllDowngraded() {
        List<CrossSourceDuplicateReport.Candidate> result =
                CrossSourceDuplicateReport.applyAmbiguityGuard(List.of(
                        candidate(9429, 8699, EventMatcher.Confidence.STRONG),
                        candidate(9429, 7276, EventMatcher.Confidence.STRONG)));

        assertTrue(result.stream().allMatch(c -> c.confidence() == EventMatcher.Confidence.WEAK),
                "Belirsiz durumda hicbiri otomatik birlestirmeye aday olmamali");
        assertTrue(result.get(0).reason().startsWith("Birden fazla guclu aday"));
    }

    /** Farkli kayitlarin kendi tekil adaylari birbirini etkilememeli. */
    @Test
    void strongCandidatesOfDifferentEventsAreIndependent() {
        List<CrossSourceDuplicateReport.Candidate> result =
                CrossSourceDuplicateReport.applyAmbiguityGuard(List.of(
                        candidate(9429, 8699, EventMatcher.Confidence.STRONG),
                        candidate(9430, 8700, EventMatcher.Confidence.STRONG)));

        assertTrue(result.stream().allMatch(c -> c.confidence() == EventMatcher.Confidence.STRONG));
    }

    @Test
    void weakCandidatesAreLeftUntouched() {
        List<CrossSourceDuplicateReport.Candidate> result =
                CrossSourceDuplicateReport.applyAmbiguityGuard(List.of(
                        candidate(9429, 8699, EventMatcher.Confidence.WEAK),
                        candidate(9429, 7276, EventMatcher.Confidence.WEAK)));

        assertTrue(result.stream().allMatch(c -> c.confidence() == EventMatcher.Confidence.WEAK));
    }
}
