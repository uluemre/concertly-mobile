package com.concertly.backend.service;

import com.concertly.backend.repository.QuizScoreRepository;
import com.concertly.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class QuizServiceTest {

    @Mock private DeezerService deezerService;
    @Mock private QuizScoreRepository quizScoreRepository;
    @Mock private UserRepository userRepository;

    private QuizService quizService;

    @BeforeEach
    void setUp() {
        quizService = new QuizService(deezerService, quizScoreRepository, userRepository);
    }

    private static List<DeezerService.Track> tracks(int count) {
        return IntStream.rangeClosed(1, count)
                .mapToObj(i -> new DeezerService.Track("Şarkı " + i, "https://cdn.example/p" + i + ".mp3", ""))
                .toList();
    }

    @Test
    @SuppressWarnings("unchecked")
    void buildsTenQuestionsWithValidOptions() {
        when(deezerService.getTopTracks(anyLong(), anyInt())).thenReturn(tracks(25));

        Map<String, Object> quiz = quizService.buildQuiz(211393L, "Hadise");
        List<Map<String, Object>> questions = (List<Map<String, Object>>) quiz.get("questions");

        assertEquals("Hadise", quiz.get("artistName"));
        assertEquals(10, questions.size());

        for (Map<String, Object> q : questions) {
            List<String> options = (List<String>) q.get("options");
            int correctIndex = (int) q.get("correctIndex");

            assertEquals(3, options.size());
            assertEquals(3, options.stream().distinct().count(), "şıklar birbirinden farklı olmalı");
            assertTrue(correctIndex >= 0 && correctIndex < 3);
            assertNotNull(q.get("previewUrl"));
            int startMs = (int) q.get("startMs");
            assertTrue(startMs >= 0 && startMs < 12000);
        }
    }

    @Test
    @SuppressWarnings("unchecked")
    void correctAnswersAreUniqueAcrossQuestions() {
        when(deezerService.getTopTracks(anyLong(), anyInt())).thenReturn(tracks(25));

        Map<String, Object> quiz = quizService.buildQuiz(1L, "Test");
        List<Map<String, Object>> questions = (List<Map<String, Object>>) quiz.get("questions");

        long distinctCorrect = questions.stream()
                .map(q -> ((List<String>) q.get("options")).get((int) q.get("correctIndex")))
                .distinct()
                .count();
        assertEquals(10, distinctCorrect, "her sorunun doğru cevabı farklı bir şarkı olmalı");
    }

    @Test
    void shrinksQuestionCountWhenFewTracks() {
        when(deezerService.getTopTracks(anyLong(), anyInt())).thenReturn(tracks(6));

        Map<String, Object> quiz = quizService.buildQuiz(1L, "Az Şarkılı");

        assertEquals(6, quiz.get("questionCount"));
    }

    @Test
    void rejectsArtistWithTooFewTracks() {
        when(deezerService.getTopTracks(anyLong(), anyInt())).thenReturn(tracks(3));

        assertThrows(IllegalArgumentException.class, () -> quizService.buildQuiz(1L, "Bilinmeyen"));
    }

    // ── Blind Ranking ───────────────────────────────────────────────────────

    @Test
    @SuppressWarnings("unchecked")
    void blindRankReturnsTenDistinctTracks() {
        when(deezerService.getTopTracks(anyLong(), anyInt())).thenReturn(tracks(25));

        Map<String, Object> result = quizService.buildBlindRank(1L, "Hadise");
        List<Map<String, Object>> selected = (List<Map<String, Object>>) result.get("tracks");

        assertEquals("Hadise", result.get("artistName"));
        assertEquals(10, selected.size());
        assertEquals(10, selected.stream().map(r -> r.get("title")).distinct().count());
        selected.forEach(r -> assertNotNull(r.get("previewUrl")));
    }

    @Test
    @SuppressWarnings("unchecked")
    void blindRankShrinksWithSmallPool() {
        when(deezerService.getTopTracks(anyLong(), anyInt())).thenReturn(tracks(6));

        Map<String, Object> result = quizService.buildBlindRank(1L, "Az Şarkılı");

        assertEquals(6, ((List<Map<String, Object>>) result.get("tracks")).size());
    }

    @Test
    void blindRankRejectsTooFewTracks() {
        when(deezerService.getTopTracks(anyLong(), anyInt())).thenReturn(tracks(3));

        assertThrows(IllegalArgumentException.class, () -> quizService.buildBlindRank(1L, "Bilinmeyen"));
    }
}
