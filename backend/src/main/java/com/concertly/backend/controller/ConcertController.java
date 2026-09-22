package com.concertly.backend.controller;

import com.concertly.backend.dto.response.ConcertResponse;
import com.concertly.backend.model.Event;
import com.concertly.backend.repository.EventRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Mobil uygulamanin konser listesi.
 *
 * Tek is yapar: veritabanindaki yayinda ve gelecekteki konserleri sayfali
 * doner. Kaynaklarin (Ticketmaster, Biletinial, ...) varligindan haberi yok;
 * hangi kaynagin veriyi getirdigi cevapta da gecmez.
 */
@RestController
@RequestMapping("/api/concerts")
public class ConcertController {

    private static final int MAX_PAGE_SIZE = 100;

    private final EventRepository eventRepository;

    public ConcertController(EventRepository eventRepository) {
        this.eventRepository = eventRepository;
    }

    /**
     * GET /api/concerts
     * GET /api/concerts?city=Ankara
     * GET /api/concerts?artist=Duman
     * GET /api/concerts?past=true   (gecmis konserler, en yeni once)
     *
     * Sehir ve sanatci suzgecleri Turkce karakter ve buyuk/kucuk harf farkina
     * duyarsizdir; ikisi birlikte de kullanilabilir.
     */
    @GetMapping
    public Map<String, Object> list(
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String artist,
            @RequestParam(defaultValue = "false") boolean past,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);

        // Yaklasan konserler en yakin tarih once; gecmis konserler en yeni once.
        Sort sort = Sort.by(past ? Sort.Direction.DESC : Sort.Direction.ASC, "event_date");
        Page<Event> result = eventRepository.searchConcerts(
                blankToNull(city),
                blankToNull(artist),
                LocalDateTime.now(),
                past,
                PageRequest.of(safePage, safeSize, sort));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("content", result.getContent().stream().map(ConcertResponse::from).toList());
        body.put("page", result.getNumber());
        body.put("size", result.getSize());
        body.put("totalElements", result.getTotalElements());
        body.put("totalPages", result.getTotalPages());
        body.put("last", result.isLast());
        return body;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
