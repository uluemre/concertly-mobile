package com.concertly.backend.service;

import com.concertly.backend.model.DailySongPlay;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.DailySongPlayRepository;
import com.concertly.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DailySongServiceTest {

    @Mock private DeezerService deezerService;
    @Mock private DailySongPlayRepository playRepository;
    @Mock private UserRepository userRepository;

    private DailySongService service;

    @BeforeEach
    void setUp() {
        service = new DailySongService(deezerService, playRepository, userRepository, 1L);
    }

    // ── Başlık eşleştirme ───────────────────────────────────────────────────

    @Test
    void matchesIgnoringTurkishCharactersAndCase() {
        assertTrue(DailySongService.titlesMatch("ASK KAC BEDEN GIYER", "Aşk Kaç Beden Giyer"));
        assertTrue(DailySongService.titlesMatch("fırtınam", "FIRTINAM"));
        assertTrue(DailySongService.titlesMatch("Onumuz Yaz", "Önümüz Yaz"));
    }

    @Test
    void matchesIgnoringParenthesesAndPunctuation() {
        assertTrue(DailySongService.titlesMatch("Kahraman", "Kahraman (Akustik)"));
        assertTrue(DailySongService.titlesMatch("Nerdesin Askim!", "Nerdesin Aşkım"));
    }

    @Test
    void rejectsDifferentTitles() {
        assertFalse(DailySongService.titlesMatch("Kahraman", "Fırtınam"));
        assertFalse(DailySongService.titlesMatch("", "Kahraman"));
        assertFalse(DailySongService.titlesMatch(null, "Kahraman"));
    }

    // ── Oyun akışı ──────────────────────────────────────────────────────────

    private static List<DeezerService.Track> pool() {
        return List.of(
                new DeezerService.Track("Şarkı A", "p1.mp3", "", "Sanatçı 1"),
                new DeezerService.Track("Şarkı B", "p2.mp3", "", "Sanatçı 2"),
                new DeezerService.Track("Şarkı C", "p3.mp3", "", "Sanatçı 3")
        );
    }

    private User user() {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", 1L);
        return u;
    }

    @Test
    void correctGuessSolvesAndRevealsAnswer() {
        when(deezerService.getPlaylistTracks(anyLong(), anyInt())).thenReturn(pool());
        when(playRepository.findByUserIdAndEpochDay(anyLong(), anyLong())).thenReturn(Optional.empty());
        when(userRepository.findById(1L)).thenReturn(Optional.of(user()));
        when(playRepository.findByUserIdAndSolvedTrueOrderByEpochDayDesc(1L)).thenReturn(List.of());

        long today = LocalDate.now().toEpochDay();
        String expectedTitle = pool().get((int) (today % 3)).title;

        Map<String, Object> result = service.guess(1L, expectedTitle, false);

        assertTrue((boolean) result.get("correct"));
        assertTrue((boolean) result.get("finished"));
        assertEquals(1, result.get("attemptsUsed"));
        assertNotNull(result.get("answer"));
    }

    @Test
    void wrongGuessDoesNotRevealAnswerUntilLastAttempt() {
        when(deezerService.getPlaylistTracks(anyLong(), anyInt())).thenReturn(pool());
        when(playRepository.findByUserIdAndEpochDay(anyLong(), anyLong())).thenReturn(Optional.empty());
        when(userRepository.findById(1L)).thenReturn(Optional.of(user()));

        Map<String, Object> result = service.guess(1L, "kesinlikle yanlis cevap", false);

        assertFalse((boolean) result.get("correct"));
        assertFalse((boolean) result.get("finished"));
        assertNull(result.get("answer"), "bitmeden cevap sızmamalı");
    }

    @Test
    void fifthWrongAttemptFinishesAndRevealsAnswer() {
        when(deezerService.getPlaylistTracks(anyLong(), anyInt())).thenReturn(pool());
        DailySongPlay existing = new DailySongPlay();
        existing.setUser(user());
        existing.setEpochDay(LocalDate.now().toEpochDay());
        existing.setAttemptsUsed(4);
        when(playRepository.findByUserIdAndEpochDay(anyLong(), anyLong())).thenReturn(Optional.of(existing));
        when(playRepository.findByUserIdAndSolvedTrueOrderByEpochDayDesc(1L)).thenReturn(List.of());

        Map<String, Object> result = service.guess(1L, "yine yanlis", false);

        assertFalse((boolean) result.get("correct"));
        assertTrue((boolean) result.get("finished"));
        assertEquals(5, result.get("attemptsUsed"));
        assertNotNull(result.get("answer"));
    }

    @Test
    void getTodayHidesAnswerForNewPlayer() {
        when(deezerService.getPlaylistTracks(anyLong(), anyInt())).thenReturn(pool());
        when(playRepository.findByUserIdAndEpochDay(anyLong(), anyLong())).thenReturn(Optional.empty());
        when(playRepository.findByUserIdAndSolvedTrueOrderByEpochDayDesc(1L)).thenReturn(List.of());

        Map<String, Object> result = service.getToday(1L);

        assertFalse((boolean) result.get("finished"));
        assertNull(result.get("answer"));
        assertNotNull(result.get("previewUrl"));
        assertEquals(5, result.get("maxAttempts"));
    }
}
