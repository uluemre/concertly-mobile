package com.concertly.backend.controller;

import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.DeezerService;
import com.concertly.backend.service.QuizService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/quiz")
public class QuizController {

    private final QuizService quizService;
    private final DeezerService deezerService;

    public QuizController(QuizService quizService, DeezerService deezerService) {
        this.quizService = quizService;
        this.deezerService = deezerService;
    }

    @GetMapping("/artists")
    public List<Map<String, Object>> searchArtists(@RequestParam String q) {
        return deezerService.searchArtists(q, 8);
    }

    @GetMapping("/questions")
    public Map<String, Object> getQuestions(@RequestParam long artistId, @RequestParam String artistName) {
        return quizService.buildQuiz(artistId, artistName);
    }

    @GetMapping("/blind-rank")
    public Map<String, Object> getBlindRank(@RequestParam long artistId, @RequestParam String artistName) {
        return quizService.buildBlindRank(artistId, artistName);
    }

    @PostMapping("/score")
    @ResponseStatus(HttpStatus.CREATED)
    public void saveScore(@RequestBody Map<String, Object> body) {
        Long myId = JwtUtil.getCurrentUserId();
        quizService.saveScore(
                myId,
                (String) body.get("artistName"),
                ((Number) body.get("score")).intValue(),
                ((Number) body.get("correctCount")).intValue(),
                ((Number) body.get("totalQuestions")).intValue(),
                ((Number) body.get("durationMs")).longValue()
        );
    }

    @GetMapping("/leaderboard")
    public Map<String, Object> leaderboard(@RequestParam String artist) {
        return quizService.getLeaderboard(artist, JwtUtil.getCurrentUserId());
    }
}
