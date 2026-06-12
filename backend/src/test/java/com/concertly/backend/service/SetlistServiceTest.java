package com.concertly.backend.service;

import com.concertly.backend.model.Artist;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.SetlistSubmission;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.SetlistSubmissionRepository;
import com.concertly.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SetlistServiceTest {

    @Mock private DeezerService deezerService;
    @Mock private SetlistSubmissionRepository submissionRepository;
    @Mock private EventRepository eventRepository;
    @Mock private UserRepository userRepository;

    private SetlistService service;

    @BeforeEach
    void setUp() {
        service = new SetlistService(deezerService, submissionRepository, eventRepository, userRepository);
    }

    private static Event event(LocalDateTime date) {
        Event e = new Event();
        e.setName("Hadise Konseri");
        e.setEventDate(date);
        Artist a = new Artist();
        a.setName("Hadise");
        e.setArtist(a);
        return e;
    }

    private static User user(long id) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setUsername("u" + id);
        return u;
    }

    private static SetlistSubmission confirmation(String titles) {
        SetlistSubmission s = new SetlistSubmission();
        s.setKind(SetlistSubmission.KIND_CONFIRMATION);
        s.setTitles(titles);
        return s;
    }

    // ── Çoğunluk mantığı ────────────────────────────────────────────────────

    @Test
    void majorityRequiresAtLeastHalfOfConfirmations() {
        List<SetlistSubmission> confirmations = List.of(
                confirmation("Kahraman|Fırtınam|Superman"),
                confirmation("Kahraman|Fırtınam"),
                confirmation("Kahraman|Prenses")
        );

        Set<String> played = SetlistService.majorityPlayedSet(confirmations);

        // eşik (3+1)/2 = 2 bildirim
        assertTrue(played.contains("Kahraman"));   // 3 bildirim
        assertTrue(played.contains("Fırtınam"));   // 2 bildirim
        assertFalse(played.contains("Superman"));  // 1 bildirim
        assertFalse(played.contains("Prenses"));   // 1 bildirim
    }

    @Test
    void emptyConfirmationsMeansNothingPlayed() {
        assertTrue(SetlistService.majorityPlayedSet(List.of()).isEmpty());
    }

    // ── Tahmin doğrulamaları ────────────────────────────────────────────────

    @Test
    void rejectsPredictionAfterEvent() {
        when(eventRepository.findById(1L)).thenReturn(Optional.of(event(LocalDateTime.now().minusDays(1))));

        assertThrows(IllegalArgumentException.class,
                () -> service.submitPrediction(1L, 1L, List.of("A", "B", "C")));
    }

    @Test
    void rejectsTooFewOrTooManyTitles() {
        when(eventRepository.findById(1L)).thenReturn(Optional.of(event(LocalDateTime.now().plusDays(1))));

        assertThrows(IllegalArgumentException.class,
                () -> service.submitPrediction(1L, 1L, List.of("A", "B")));
        assertThrows(IllegalArgumentException.class,
                () -> service.submitPrediction(1L, 1L,
                        List.of("A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K")));
    }

    @Test
    void savesValidPrediction() {
        when(eventRepository.findById(1L)).thenReturn(Optional.of(event(LocalDateTime.now().plusDays(1))));
        when(submissionRepository.findByUserIdAndEventIdAndKind(1L, 1L, SetlistSubmission.KIND_PREDICTION))
                .thenReturn(Optional.empty());
        when(userRepository.findById(1L)).thenReturn(Optional.of(user(1L)));

        service.submitPrediction(1L, 1L, List.of("Kahraman", "Fırtınam", "Superman"));

        verify(submissionRepository).save(any(SetlistSubmission.class));
    }

    // ── Setlist bildirimi doğrulaması ───────────────────────────────────────

    @Test
    void rejectsConfirmationBeforeEvent() {
        when(eventRepository.findById(1L)).thenReturn(Optional.of(event(LocalDateTime.now().plusDays(1))));

        assertThrows(IllegalArgumentException.class,
                () -> service.submitConfirmation(1L, 1L, List.of("Kahraman")));
    }

    // ── Lig tablosu ─────────────────────────────────────────────────────────

    @Test
    void leaderboardScoresHitsAgainstMajoritySetlist() {
        when(submissionRepository.findByEventIdAndKind(1L, SetlistSubmission.KIND_CONFIRMATION))
                .thenReturn(List.of(confirmation("Kahraman|Fırtınam")));

        SetlistSubmission goodPrediction = new SetlistSubmission();
        goodPrediction.setUser(user(1L));
        goodPrediction.setTitles("Kahraman|Fırtınam|Superman");
        SetlistSubmission weakPrediction = new SetlistSubmission();
        weakPrediction.setUser(user(2L));
        weakPrediction.setTitles("Superman|Prenses|Deli Oğlan");
        when(submissionRepository.findByEventIdAndKind(1L, SetlistSubmission.KIND_PREDICTION))
                .thenReturn(List.of(weakPrediction, goodPrediction));

        Map<String, Object> board = service.getLeaderboard(1L);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) board.get("rows");
        assertEquals(2, rows.size());
        // iyi tahmin (2 isabet = 20 puan) başta olmalı
        assertEquals("u1", rows.get(0).get("username"));
        assertEquals(20L, rows.get(0).get("score"));
        assertEquals("u2", rows.get(1).get("username"));
        assertEquals(0L, rows.get(1).get("score"));
    }
}
