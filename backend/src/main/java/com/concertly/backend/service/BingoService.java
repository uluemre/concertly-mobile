package com.concertly.backend.service;

import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.BingoCard;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.BingoCardRepository;
import com.concertly.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class BingoService {

    // 25 squares for a 5x5 bingo card (TR/EN handled on mobile)
    public static final List<String> SQUARES = List.of(
            "encore",
            "crowd_surf",
            "phone_sea",
            "first_album_song",
            "biggest_hit",
            "new_album_song",
            "wore_sunglasses",
            "sang_with_crowd",
            "threw_water",
            "forgot_lyrics",
            "drum_solo",
            "said_last_song",
            "confetti",
            "stage_dive",
            "said_city_name",
            "changed_outfit",
            "acoustic_version",
            "remix_mashup",
            "announced_new_song",
            "vip_went_crazy",
            "artist_cried",
            "show_started_late",
            "mosh_pit",
            "crowd_chant",
            "guitar_solo"
    );

    // Winning lines: rows, columns, diagonals (indices into the 25-square grid)
    private static final int[][] WIN_LINES = {
            {0,1,2,3,4}, {5,6,7,8,9}, {10,11,12,13,14}, {15,16,17,18,19}, {20,21,22,23,24}, // rows
            {0,5,10,15,20}, {1,6,11,16,21}, {2,7,12,17,22}, {3,8,13,18,23}, {4,9,14,19,24}, // cols
            {0,6,12,18,24}, {4,8,12,16,20}  // diagonals
    };

    private final BingoCardRepository bingoCardRepository;
    private final UserRepository userRepository;

    public BingoService(BingoCardRepository bingoCardRepository, UserRepository userRepository) {
        this.bingoCardRepository = bingoCardRepository;
        this.userRepository = userRepository;
    }

    public List<String> getSquares() {
        return SQUARES;
    }

    @Transactional
    public Map<String, Object> getOrCreateCard(Long userId, Long eventId, String eventName) {
        BingoCard card;
        if (eventId != null) {
            card = bingoCardRepository.findByUserIdAndEventId(userId, eventId)
                    .orElseGet(() -> createCard(userId, eventId, eventName));
        } else {
            card = createCard(userId, null, eventName);
        }
        return toMap(card);
    }

    @Transactional
    public Map<String, Object> toggleMark(Long cardId, Long userId, int squareIndex) {
        BingoCard card = bingoCardRepository.findById(cardId)
                .filter(c -> c.getUser().getId().equals(userId))
                .orElseThrow(() -> new ResourceNotFoundException("Bingo card not found"));

        Set<Integer> marked = parseMarked(card.getMarkedSquares());
        if (!marked.add(squareIndex)) {
            marked.remove(squareIndex);
        }

        card.setMarkedSquares(marked.stream().map(String::valueOf).collect(Collectors.joining(",")));
        card.setHasBingo(checkBingo(marked));
        bingoCardRepository.save(card);
        return toMap(card);
    }

    private BingoCard createCard(Long userId, Long eventId, String eventName) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        BingoCard card = new BingoCard();
        card.setUser(user);
        card.setEventId(eventId);
        card.setEventName(eventName);
        return bingoCardRepository.save(card);
    }

    private boolean checkBingo(Set<Integer> marked) {
        for (int[] line : WIN_LINES) {
            boolean win = true;
            for (int idx : line) {
                if (!marked.contains(idx)) { win = false; break; }
            }
            if (win) return true;
        }
        return false;
    }

    private Set<Integer> parseMarked(String raw) {
        Set<Integer> result = new HashSet<>();
        if (raw == null || raw.isBlank()) return result;
        for (String s : raw.split(",")) {
            try { result.add(Integer.parseInt(s.trim())); } catch (NumberFormatException ignored) {}
        }
        return result;
    }

    private Map<String, Object> toMap(BingoCard card) {
        Set<Integer> marked = parseMarked(card.getMarkedSquares());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", card.getId());
        m.put("eventId", card.getEventId());
        m.put("eventName", card.getEventName());
        m.put("squares", SQUARES);
        m.put("markedIndices", new ArrayList<>(marked));
        m.put("hasBingo", card.isHasBingo());
        m.put("createdAt", card.getCreatedAt());
        return m;
    }
}
