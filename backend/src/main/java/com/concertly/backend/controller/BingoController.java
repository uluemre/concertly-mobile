package com.concertly.backend.controller;

import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.BingoService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/bingo")
public class BingoController {

    private final BingoService bingoService;

    public BingoController(BingoService bingoService) {
        this.bingoService = bingoService;
    }

    @GetMapping("/squares")
    public List<String> getSquares() {
        return bingoService.getSquares();
    }

    @PostMapping("/card")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> getOrCreate(@RequestBody Map<String, Object> body) {
        Long userId = JwtUtil.getCurrentUserId();
        Long eventId = body.get("eventId") != null ? ((Number) body.get("eventId")).longValue() : null;
        String eventName = (String) body.get("eventName");
        return bingoService.getOrCreateCard(userId, eventId, eventName);
    }

    @PutMapping("/card/{cardId}/toggle")
    public Map<String, Object> toggle(@PathVariable Long cardId,
                                      @RequestBody Map<String, Object> body) {
        Long userId = JwtUtil.getCurrentUserId();
        int index = ((Number) body.get("index")).intValue();
        return bingoService.toggleMark(cardId, userId, index);
    }
}
