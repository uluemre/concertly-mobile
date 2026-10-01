package com.concertly.backend.controller;

import com.concertly.backend.service.ingest.DuplicateMergeReport;
import com.concertly.backend.service.ingest.DuplicateMergeReport.ApplyRequest;
import com.concertly.backend.service.ingest.DuplicateMergeService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Mukerrer sanatci / mekan / etkinlik yumusak birlestirmesi (N-08 / N-09), yalnizca admin.
 *
 * /api/admin/** SecurityConfig'te ROLE_ADMIN ile korunuyor; ek kural gerekmez.
 * Once dry-run (hicbir sey yazmaz), sonra apply (tek transaction). Hicbir satir silinmez.
 */
@RestController
@RequestMapping("/api/admin/merge")
public class AdminMergeController {

    private final DuplicateMergeService mergeService;

    public AdminMergeController(DuplicateMergeService mergeService) {
        this.mergeService = mergeService;
    }

    /** Rapor: gruplar, sebep/guven ve tasinacak sayilar. Veriyi DEGISTIRMEZ. */
    @GetMapping("/duplicates/dry-run")
    public DuplicateMergeReport dryRun(@RequestParam(required = false) String minConfidence) {
        return mergeService.dryRun(minConfidence);
    }

    /** Yalnizca HIGH guvenli eslesmeleri tek transaction ile uygular (minConfidence YOK SAYILIR); MEDIUM/LOW elle birlestirilir. */
    @PostMapping("/duplicates/apply")
    public DuplicateMergeReport apply(@RequestBody(required = false) ApplyRequest request) {
        return mergeService.apply(request);
    }

    /** Elle duzeltme: dupId sanatcisini canonicalId sanatcisinin (kokune) birlestirir. */
    @PostMapping("/artists/{dupId}/into/{canonicalId}")
    public DuplicateMergeReport mergeArtist(@PathVariable Long dupId, @PathVariable Long canonicalId) {
        return mergeService.mergeArtistManually(dupId, canonicalId);
    }

    /** Elle duzeltme: mekan (ayni sehir sartiyla). */
    @PostMapping("/venues/{dupId}/into/{canonicalId}")
    public DuplicateMergeReport mergeVenue(@PathVariable Long dupId, @PathVariable Long canonicalId) {
        return mergeService.mergeVenueManually(dupId, canonicalId);
    }
}
