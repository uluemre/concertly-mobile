package com.concertly.backend.controller;

import com.concertly.backend.dto.response.DuplicateCandidateResponse;
import com.concertly.backend.service.ingest.ConcertSyncScheduler;
import com.concertly.backend.service.ingest.CrossSourceDuplicateReport;
import com.concertly.backend.service.ingest.SourceSyncResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Konser veri kaynaklarini elle tetikleme ve listeleme (admin).
 *
 * /api/admin/** zaten ROLE_ADMIN ile korunuyor, ek guvenlik kurali gerekmedi.
 * Yeni bir kaynak eklendiginde bu controller degismez; zamanlayici tum
 * ConcertSource bean'lerini kendisi bulur.
 */
@RestController
@RequestMapping("/api/admin/sources")
public class AdminSourceController {

    private final ConcertSyncScheduler scheduler;
    private final CrossSourceDuplicateReport duplicateReport;

    public AdminSourceController(ConcertSyncScheduler scheduler,
            CrossSourceDuplicateReport duplicateReport) {
        this.scheduler = scheduler;
        this.duplicateReport = duplicateReport;
    }

    /** Tanimli kaynaklar. */
    @GetMapping
    public Map<String, Object> sources() {
        return Map.of("sources", scheduler.availableSources());
    }

    /** Tum kaynaklari sirayla calistirir; biri hata verse de digerleri calisir. */
    @PostMapping("/sync")
    public List<SourceSyncResult> syncAll() {
        return scheduler.syncAll();
    }

    /**
     * Kaynaklar arasi mukerrer adaylari (SALT OKUNUR).
     *
     * Hicbir kaydi degistirmez, silmez, birlestirmez. Her aday icin iki
     * etkinligin tam bilgisi doner ki karari veren kisi iki satiri yan yana
     * gorup kendisi hukmedebilsin.
     *
     * ?confidence=STRONG ile yalnizca guclu adaylar suzulebilir.
     */
    @GetMapping("/duplicates")
    public Map<String, Object> duplicates(
            @RequestParam(required = false) String confidence) {

        List<DuplicateCandidateResponse> all = duplicateReport.findDetailedCandidates();
        List<DuplicateCandidateResponse> shown = confidence == null || confidence.isBlank()
                ? all
                : all.stream()
                        .filter(c -> c.confidence().equalsIgnoreCase(confidence.trim()))
                        .toList();

        long strong = all.stream().filter(c -> "STRONG".equals(c.confidence())).count();
        long weak = all.stream().filter(c -> "WEAK".equals(c.confidence())).count();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("total", all.size());
        body.put("strong", strong);
        body.put("weak", weak);
        body.put("readOnly", true);
        body.put("candidates", shown);
        return body;
    }

    /** Tek kaynagi calistirir, ornegin /api/admin/sources/biletinial/sync. */
    @PostMapping("/{code}/sync")
    public SourceSyncResult syncOne(@PathVariable String code) {
        return scheduler.syncByCode(code);
    }
}
