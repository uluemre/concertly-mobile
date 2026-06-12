package com.concertly.backend.controller;

import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.DailySongService;
import com.concertly.backend.service.DeezerService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/daily-song")
public class DailySongController {

    private final DailySongService dailySongService;
    private final DeezerService deezerService;

    public DailySongController(DailySongService dailySongService, DeezerService deezerService) {
        this.dailySongService = dailySongService;
        this.deezerService = deezerService;
    }

    @GetMapping("/today")
    public Map<String, Object> today() {
        return dailySongService.getToday(JwtUtil.getCurrentUserId());
    }

    @PostMapping("/guess")
    public Map<String, Object> guess(@RequestBody Map<String, Object> body) {
        String guess = body.get("guess") != null ? body.get("guess").toString() : null;
        boolean skip = Boolean.parseBoolean(String.valueOf(body.getOrDefault("skip", "false")));
        return dailySongService.guess(JwtUtil.getCurrentUserId(), guess, skip);
    }

    @GetMapping("/search")
    public List<Map<String, Object>> search(@RequestParam String q) {
        return deezerService.searchTracks(q, 6);
    }
}
