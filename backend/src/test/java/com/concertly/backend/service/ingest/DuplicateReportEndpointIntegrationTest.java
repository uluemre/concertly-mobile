package com.concertly.backend.service.ingest;

import com.concertly.backend.dto.response.DuplicateCandidateResponse;
import com.concertly.backend.repository.EventRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.format.DateTimeFormatter;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Admin mukerrer inceleme ucunun gercek veritabanindaki ciktisi.
 *
 * En onemli guvence: rapor SALT OKUNUR. Test, cagri oncesi ve sonrasi kayit
 * sayilarini ve kimliklerini karsilastirarak bunu dogruluyor.
 *
 * Calistirma:
 *   ./mvnw test -Dtest=DuplicateReportEndpointIntegrationTest -Dmatching.report=true -DfailIfNoTests=false
 */
@SpringBootTest
@EnabledIfSystemProperty(named = "matching.report", matches = "true")
class DuplicateReportEndpointIntegrationTest {

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm");

    @Autowired private CrossSourceDuplicateReport report;
    @Autowired private EventRepository eventRepository;

    @Test
    void returnsDetailedPairsAndChangesNothing() {
        long countBefore = eventRepository.count();
        List<Long> idsBefore = eventRepository.findAll().stream().map(e -> e.getId()).sorted().toList();

        List<DuplicateCandidateResponse> candidates = report.findDetailedCandidates();

        long strong = candidates.stream().filter(c -> "STRONG".equals(c.confidence())).count();
        long weak = candidates.stream().filter(c -> "WEAK".equals(c.confidence())).count();

        System.out.println();
        System.out.println("=".repeat(78));
        System.out.println("GET /api/admin/sources/duplicates");
        System.out.println("=".repeat(78));
        System.out.println("total=" + candidates.size() + "  strong=" + strong + "  weak=" + weak);
        System.out.println("-".repeat(78));

        candidates.stream().limit(3).forEach(c -> {
            System.out.println("[" + c.confidence() + "] " + c.minutesApart() + " dk fark - " + c.reason());
            printSide("  biletinial", c.biletinial());
            printSide("  other     ", c.other());
            System.out.println("-".repeat(78));
        });

        long countAfter = eventRepository.count();
        List<Long> idsAfter = eventRepository.findAll().stream().map(e -> e.getId()).sorted().toList();

        assertEquals(countBefore, countAfter, "Rapor kayit sayisini degistirmemeli");
        assertEquals(idsBefore, idsAfter, "Rapor kayit kimliklerini degistirmemeli");

        // Her aday cift olmali ve iki tarafi da dolu gelmeli.
        assertTrue(candidates.stream().allMatch(c -> c.biletinial() != null && c.other() != null),
                "Her adayin iki tarafi da dolu olmali");
        assertTrue(candidates.stream().allMatch(c ->
                        !c.biletinial().eventId().equals(c.other().eventId())),
                "Bir kayit kendisiyle eslesmemeli");
        assertTrue(candidates.stream().allMatch(c ->
                        "BILETINIAL".equals(c.biletinial().source())),
                "Sol taraf her zaman Biletinial kaydi olmali");
        assertTrue(candidates.stream().allMatch(c ->
                        "STRONG".equals(c.confidence()) || "WEAK".equals(c.confidence())),
                "Guven degeri yalnizca STRONG ya da WEAK olabilir");
    }

    private static void printSide(String label, DuplicateCandidateResponse.EventSide side) {
        System.out.println(label + " #" + side.eventId()
                + " | " + side.source()
                + " | " + side.artistName()
                + " | " + (side.eventDate() != null ? side.eventDate().format(TS) : "-")
                + " | " + side.venueName()
                + " | " + side.city()
                + " | " + side.latitude() + "," + side.longitude()
                + " | " + side.ticketUrl());
    }
}
