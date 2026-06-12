package com.concertly.backend.controller;

import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.SetlistService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/setlist")
public class SetlistController {

    private final SetlistService setlistService;

    public SetlistController(SetlistService setlistService) {
        this.setlistService = setlistService;
    }

    @GetMapping("/{eventId}")
    public Map<String, Object> state(@PathVariable Long eventId) {
        return setlistService.getState(eventId, JwtUtil.getCurrentUserId());
    }

    @PostMapping("/{eventId}/prediction")
    @ResponseStatus(HttpStatus.CREATED)
    @SuppressWarnings("unchecked")
    public void prediction(@PathVariable Long eventId, @RequestBody Map<String, Object> body) {
        setlistService.submitPrediction(eventId, JwtUtil.getCurrentUserId(), (List<String>) body.get("titles"));
    }

    @PostMapping("/{eventId}/confirm")
    @ResponseStatus(HttpStatus.CREATED)
    @SuppressWarnings("unchecked")
    public void confirm(@PathVariable Long eventId, @RequestBody Map<String, Object> body) {
        setlistService.submitConfirmation(eventId, JwtUtil.getCurrentUserId(), (List<String>) body.get("titles"));
    }

    @GetMapping("/{eventId}/leaderboard")
    public Map<String, Object> leaderboard(@PathVariable Long eventId) {
        return setlistService.getLeaderboard(eventId);
    }
}
