package com.concertly.backend.controller;

import com.concertly.backend.dto.response.SearchResponse;
import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.SearchService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/search")
public class SearchController {

    private final SearchService searchService;

    public SearchController(SearchService searchService) {
        this.searchService = searchService;
    }

    @GetMapping
    public SearchResponse search(@RequestParam String q) {
        Long currentUserId = JwtUtil.getCurrentUserId();
        return searchService.search(q, currentUserId);
    }
}