package com.concertly.backend.controller;

import com.concertly.backend.config.AdminAuditInterceptor;
import com.concertly.backend.service.AdminContentService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Admin: sanatçı ve mekân düzenleme, tüm topluluklar. /api/admin/** zaten ROLE_ADMIN ister. */
@RestController
@RequestMapping("/api/admin")
public class AdminContentController {

    private final AdminContentService content;

    public AdminContentController(AdminContentService content) {
        this.content = content;
    }

    @GetMapping("/artists")
    public List<Map<String, Object>> artists(@RequestParam(required = false) String q,
                                             @RequestParam(defaultValue = "0") int page) {
        return content.listArtists(q, page);
    }

    @GetMapping("/artists/{id}")
    public Map<String, Object> artist(@PathVariable Long id) {
        return content.getArtist(id);
    }

    /** Gövde: { name?, genre?, imageUrl? } — imageUrl "" fotoğrafı sıfırlar (otomatik arama döner). */
    @PutMapping("/artists/{id}")
    public Map<String, Object> updateArtist(@PathVariable Long id, @RequestBody Map<String, Object> body,
                                            HttpServletRequest request) {
        audit(request, content.updateArtist(id, body));
        return content.getArtist(id);
    }

    @GetMapping("/venues")
    public List<Map<String, Object>> venues(@RequestParam(required = false) String q,
                                            @RequestParam(required = false) String city,
                                            @RequestParam(defaultValue = "0") int page) {
        return content.listVenues(q, city, page);
    }

    @GetMapping("/venues/{id}")
    public Map<String, Object> venue(@PathVariable Long id) {
        return content.getVenue(id);
    }

    /** Gövde: { name?, city?, address?, latitude?, longitude?, imageUrl? } */
    @PutMapping("/venues/{id}")
    public Map<String, Object> updateVenue(@PathVariable Long id, @RequestBody Map<String, Object> body,
                                           HttpServletRequest request) {
        audit(request, content.updateVenue(id, body));
        return content.getVenue(id);
    }

    @GetMapping("/communities/all")
    public List<Map<String, Object>> communities(@RequestParam(required = false) String q,
                                                 @RequestParam(defaultValue = "0") int page) {
        return content.listCommunities(q, page);
    }

    private static void audit(HttpServletRequest request, List<String> diff) {
        if (!diff.isEmpty()) request.setAttribute(AdminAuditInterceptor.DETAIL, String.join("\n", diff));
    }
}
