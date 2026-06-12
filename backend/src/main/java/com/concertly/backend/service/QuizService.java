package com.concertly.backend.service;

import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.QuizScore;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.QuizScoreRepository;
import com.concertly.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class QuizService {

    private static final int QUESTION_COUNT = 10;
    private static final int MIN_TRACKS = 4; // 1 doğru + 2 çeldirici için en az 3, marj payıyla 4

    private final DeezerService deezerService;
    private final QuizScoreRepository quizScoreRepository;
    private final UserRepository userRepository;

    public QuizService(DeezerService deezerService,
                       QuizScoreRepository quizScoreRepository,
                       UserRepository userRepository) {
        this.deezerService = deezerService;
        this.quizScoreRepository = quizScoreRepository;
        this.userRepository = userRepository;
    }

    /** Sanatçının top şarkılarından çoktan seçmeli sorular üretir. */
    public Map<String, Object> buildQuiz(long artistId, String artistName) {
        List<DeezerService.Track> tracks = deezerService.getTopTracks(artistId, 50);

        if (tracks.size() < MIN_TRACKS) {
            throw new IllegalArgumentException("Bu sanatçı için yeterli şarkı bulunamadı");
        }

        List<DeezerService.Track> pool = new ArrayList<>(tracks);
        Collections.shuffle(pool);

        int questionCount = Math.min(QUESTION_COUNT, pool.size());
        List<Map<String, Object>> questions = new ArrayList<>();
        Random random = new Random();

        for (int i = 0; i < questionCount; i++) {
            DeezerService.Track correct = pool.get(i);

            // Çeldiriciler: aynı sanatçının diğer şarkıları
            List<DeezerService.Track> others = new ArrayList<>(pool);
            others.remove(correct);
            Collections.shuffle(others);

            List<String> options = new ArrayList<>();
            options.add(correct.title);
            options.add(others.get(0).title);
            options.add(others.get(1).title);
            Collections.shuffle(options);

            Map<String, Object> q = new LinkedHashMap<>();
            q.put("previewUrl", correct.previewUrl);
            q.put("coverUrl", correct.coverUrl);
            q.put("options", options);
            q.put("correctIndex", options.indexOf(correct.title));
            // Önizleme 30 sn — rastgele bir noktadan başlat (0-12 sn arası) ki ezber bozulsun
            q.put("startMs", random.nextInt(12000));
            questions.add(q);
        }

        Map<String, Object> quiz = new LinkedHashMap<>();
        quiz.put("artistName", artistName);
        quiz.put("questionCount", questionCount);
        quiz.put("questions", questions);
        return quiz;
    }

    /** Blind Ranking için sanatçının şarkılarından rastgele 10'luk set döner. */
    public Map<String, Object> buildBlindRank(long artistId, String artistName) {
        List<DeezerService.Track> tracks = deezerService.getTopTracks(artistId, 50);

        if (tracks.size() < MIN_TRACKS) {
            throw new IllegalArgumentException("Bu sanatçı için yeterli şarkı bulunamadı");
        }

        List<DeezerService.Track> pool = new ArrayList<>(tracks);
        Collections.shuffle(pool);

        List<Map<String, Object>> selected = pool.stream()
                .limit(QUESTION_COUNT)
                .map(track -> {
                    Map<String, Object> row = new LinkedHashMap<String, Object>();
                    row.put("title", track.title);
                    row.put("coverUrl", track.coverUrl);
                    row.put("previewUrl", track.previewUrl);
                    return row;
                })
                .toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("artistName", artistName);
        result.put("tracks", selected);
        return result;
    }

    @Transactional
    public void saveScore(Long userId, String artistName, int score,
                          int correctCount, int totalQuestions, long durationMs) {
        if (artistName == null || artistName.isBlank()) {
            throw new IllegalArgumentException("Sanatçı adı zorunlu");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId));

        QuizScore qs = new QuizScore();
        qs.setUser(user);
        qs.setArtistName(artistName.trim());
        qs.setScore(score);
        qs.setCorrectCount(correctCount);
        qs.setTotalQuestions(totalQuestions);
        qs.setDurationMs(durationMs);
        quizScoreRepository.save(qs);
    }

    /** Sanatçı bazlı top 10 + isteyen kullanıcının kişisel rekoru. */
    public Map<String, Object> getLeaderboard(String artistName, Long currentUserId) {
        List<Map<String, Object>> top = quizScoreRepository
                .findTop10ByArtistNameIgnoreCaseOrderByScoreDescDurationMsAsc(artistName)
                .stream()
                .map(qs -> {
                    Map<String, Object> row = new LinkedHashMap<String, Object>();
                    row.put("userId", qs.getUser().getId());
                    row.put("username", qs.getUser().getUsername());
                    row.put("profileImageUrl", qs.getUser().getProfileImageUrl() != null ? qs.getUser().getProfileImageUrl() : "");
                    row.put("score", qs.getScore());
                    row.put("correctCount", qs.getCorrectCount());
                    row.put("totalQuestions", qs.getTotalQuestions());
                    return row;
                })
                .toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("artistName", artistName);
        result.put("top", top);

        quizScoreRepository
                .findFirstByArtistNameIgnoreCaseAndUserIdOrderByScoreDescDurationMsAsc(artistName, currentUserId)
                .ifPresent(best -> result.put("myBest", Map.of(
                        "score", best.getScore(),
                        "correctCount", best.getCorrectCount(),
                        "totalQuestions", best.getTotalQuestions()
                )));

        return result;
    }
}
