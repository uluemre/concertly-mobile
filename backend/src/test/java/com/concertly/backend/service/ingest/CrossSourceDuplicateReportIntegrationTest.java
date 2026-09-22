package com.concertly.backend.service.ingest;

import com.concertly.backend.repository.EventRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

/**
 * ASAMA 4 dogrulamasi: mevcut veritabaninda kac potansiyel mukerrer var.
 *
 * Tamamen SALT OKUNUR. Test, tarama oncesi ve sonrasi kayit sayilarini
 * karsilastirarak hicbir seyin silinmedigini/degismedigini de dogrular.
 *
 * Calistirma:
 *   ./mvnw test -Dtest=CrossSourceDuplicateReportIntegrationTest -Dmatching.report=true -DfailIfNoTests=false
 */
@SpringBootTest
@EnabledIfSystemProperty(named = "matching.report", matches = "true")
class CrossSourceDuplicateReportIntegrationTest {

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm");

    @Autowired private CrossSourceDuplicateReport report;
    @Autowired private EventRepository eventRepository;

    @Test
    void reportsCandidatesWithoutTouchingAnyRecord() {
        long eventsBefore = eventRepository.count();
        List<Long> idsBefore = eventRepository.findAll().stream()
                .map(e -> e.getId()).sorted().toList();

        List<CrossSourceDuplicateReport.Candidate> candidates = report.findCandidates();

        Map<EventMatcher.Confidence, Long> byConfidence = candidates.stream()
                .collect(Collectors.groupingBy(CrossSourceDuplicateReport.Candidate::confidence,
                        Collectors.counting()));

        System.out.println();
        System.out.println("=".repeat(76));
        System.out.println("KAYNAKLAR ARASI MUKERRER RAPORU");
        System.out.println("=".repeat(76));
        System.out.println("Taranan etkinlik      : " + eventsBefore);
        System.out.println("Bulunan aday          : " + candidates.size());
        System.out.println("  GUCLU (birlesebilir): " + byConfidence.getOrDefault(EventMatcher.Confidence.STRONG, 0L));
        System.out.println("  ZAYIF (elle bakilir): " + byConfidence.getOrDefault(EventMatcher.Confidence.WEAK, 0L));
        System.out.println("-".repeat(76));
        candidates.stream().limit(15).forEach(c -> System.out.println(
                "[" + c.confidence() + "] #" + c.biletinialEventId() + " <-> #" + c.otherEventId()
                + " | " + c.artistName()
                + " | " + c.city()
                + " | " + (c.biletinialDate() != null ? c.biletinialDate().format(TS) : "-")
                + " vs " + (c.otherDate() != null ? c.otherDate().format(TS) : "-")
                + " | " + c.biletinialVenue() + " / " + c.otherVenue()
                + " | " + c.reason()));
        if (candidates.isEmpty()) {
            System.out.println("(bu veritabaninda kaynaklar arasi ortusen konser bulunamadi)");
        }
        System.out.println("=".repeat(76));

        long eventsAfter = eventRepository.count();
        List<Long> idsAfter = eventRepository.findAll().stream()
                .map(e -> e.getId()).sorted().toList();

        System.out.println("Tarama sonrasi etkinlik: " + eventsAfter + " (once " + eventsBefore + ")");

        assertEquals(eventsBefore, eventsAfter, "Rapor hicbir kayit silmemeli/eklememeli");
        assertEquals(idsBefore, idsAfter, "Kayit kimlikleri degismemeli");
        assertTrue(candidates.stream().noneMatch(c ->
                        c.biletinialEventId().equals(c.otherEventId())),
                "Bir kayit kendisiyle eslesmemeli");
    }
}
