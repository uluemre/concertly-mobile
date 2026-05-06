package com.concertly.backend.controller;

import com.concertly.backend.dto.response.SearchResponse;
import com.concertly.backend.service.SearchService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/search")
public class SearchController {

    private final SearchService searchService;

    public SearchController(SearchService searchService) {
        this.searchService = searchService;
    }

    // GET /api/search?q=tarkan&currentUserId=5
    @GetMapping
    public SearchResponse search(
            @RequestParam String q,
            @RequestParam(required = false) Long currentUserId) {
        return searchService.search(q, currentUserId);
    }
}