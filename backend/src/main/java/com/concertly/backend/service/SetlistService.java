package com.concertly.backend.service;

import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.SetlistSubmission;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.SetlistSubmissionRepository;
import com.concertly.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class SetlistService {

    public static final int MIN_PREDICTION = 3;
    public static final int MAX_PREDICTION = 10;
    private static final int CANDIDATE_COUNT = 20;
    private static final String SEPARATOR = "|";
    private static final int POINTS_PER_HIT = 10;

    private final DeezerService deezerService;
    private final SetlistSubmissionRepository submissionRepository;
    private final EventRepository eventRepository;
    private final UserRepository userRepository;

    public SetlistService(DeezerService deezerService,
                          SetlistSubmissionRepository submissionRepository,
                          EventRepository eventRepository,
                          UserRepository userRepository) {
        this.deezerService = deezerService;
        this.submissionRepository = submissionRepository;
        this.eventRepository = eventRepository;
        this.userRepository = userRepository;
    }

    // ── Durum + aday şarkılar ───────────────────────────────────────────────

    public Map<String, Object> getState(Long eventId, Long userId) {
        Event event = requireEventWithArtist(eventId);
        boolean passed = event.getEventDate() != null && event.getEventDate().isBefore(LocalDateTime.now());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("eventName", event.getName());
        result.put("artistName", event.getArtist().getName());
        result.put("eventPassed", passed);
        result.put("minPrediction", MIN_PREDICTION);
        result.put("maxPrediction", MAX_PREDICTION);
        result.put("candidates", candidatesFor(event));

        submissionRepository.findByUserIdAndEventIdAndKind(userId, eventId, SetlistSubmission.KIND_PREDICTION)
                .ifPresentOrElse(
                        p -> result.put("myPrediction", split(p.getTitles())),
                        () -> result.put("myPrediction", null));
        submissionRepository.findByUserIdAndEventIdAndKind(userId, eventId, SetlistSubmission.KIND_CONFIRMATION)
                .ifPresentOrElse(
                        c -> result.put("myConfirmation", split(c.getTitles())),
                        () -> result.put("myConfirmation", null));

        result.put("predictionCount", submissionRepository.countByEventIdAndKind(eventId, SetlistSubmission.KIND_PREDICTION));
        result.put("confirmationCount", submissionRepository.countByEventIdAndKind(eventId, SetlistSubmission.KIND_CONFIRMATION));
        return result;
    }

    // ── Tahmin (konser öncesi) ──────────────────────────────────────────────

    @Transactional
    public void submitPrediction(Long eventId, Long userId, List<String> titles) {
        Event event = requireEventWithArtist(eventId);
        if (event.getEventDate() != null && event.getEventDate().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Konser geçti, artık tahmin yapılamaz");
        }
        List<String> cleaned = cleanTitles(titles);
        if (cleaned.size() < MIN_PREDICTION || cleaned.size() > MAX_PREDICTION) {
            throw new IllegalArgumentException(MIN_PREDICTION + "-" + MAX_PREDICTION + " arası şarkı seçmelisin");
        }
        upsert(eventId, userId, SetlistSubmission.KIND_PREDICTION, cleaned, event);
    }

    // ── Gerçek setlist bildirimi (konser sonrası) ───────────────────────────

    @Transactional
    public void submitConfirmation(Long eventId, Long userId, List<String> titles) {
        Event event = requireEventWithArtist(eventId);
        if (event.getEventDate() == null || event.getEventDate().isAfter(LocalDateTime.now())) {
            throw new IllegalArgumentException("Konser bitmeden setlist bildirilemez");
        }
        List<String> cleaned = cleanTitles(titles);
        if (cleaned.isEmpty()) {
            throw new IllegalArgumentException("En az 1 şarkı işaretlemelisin");
        }
        upsert(eventId, userId, SetlistSubmission.KIND_CONFIRMATION, cleaned, event);
    }

    // ── Lig tablosu ─────────────────────────────────────────────────────────

    public Map<String, Object> getLeaderboard(Long eventId) {
        List<SetlistSubmission> confirmations =
                submissionRepository.findByEventIdAndKind(eventId, SetlistSubmission.KIND_CONFIRMATION);
        Set<String> played = majorityPlayedSet(confirmations);

        List<Map<String, Object>> rows = submissionRepository
                .findByEventIdAndKind(eventId, SetlistSubmission.KIND_PREDICTION)
                .stream()
                .map(p -> {
                    List<String> predicted = split(p.getTitles());
                    long hits = predicted.stream().filter(played::contains).count();
                    Map<String, Object> row = new LinkedHashMap<String, Object>();
                    row.put("userId", p.getUser().getId());
                    row.put("username", p.getUser().getUsername());
                    row.put("hits", hits);
                    row.put("predicted", predicted.size());
                    row.put("score", hits * POINTS_PER_HIT);
                    return row;
                })
                .sorted((a, b) -> Long.compare((long) b.get("hits") * POINTS_PER_HIT, (long) a.get("hits") * POINTS_PER_HIT))
                .limit(20)
                .toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("playedSetlist", new ArrayList<>(played));
        result.put("confirmationCount", confirmations.size());
        result.put("rows", rows);
        return result;
    }

    // ── Yardımcılar ─────────────────────────────────────────────────────────

    /** Bir şarkı, bildirimlerin en az yarısında geçiyorsa "çalındı" sayılır. */
    static Set<String> majorityPlayedSet(List<SetlistSubmission> confirmations) {
        if (confirmations.isEmpty()) return Set.of();
        Map<String, Long> counts = confirmations.stream()
                .flatMap(c -> split(c.getTitles()).stream())
                .collect(Collectors.groupingBy(t -> t, Collectors.counting()));
        long threshold = (confirmations.size() + 1) / 2; // yarıdan az olmayan
        return counts.entrySet().stream()
                .filter(e -> e.getValue() >= threshold)
                .map(Map.Entry::getKey)
                .collect(Collectors.toSet());
    }

    private List<Map<String, Object>> candidatesFor(Event event) {
        String artistName = event.getArtist().getName();
        List<Map<String, Object>> found = deezerService.searchArtists(artistName, 1);
        if (found.isEmpty()) {
            throw new IllegalArgumentException("Sanatçı Deezer'da bulunamadı: " + artistName);
        }
        long deezerId = (long) found.get(0).get("artistId");
        List<DeezerService.Track> tracks = deezerService.getTopTracks(deezerId, 40);
        if (tracks.size() < MIN_PREDICTION) {
            throw new IllegalArgumentException("Bu sanatçı için yeterli şarkı bulunamadı");
        }
        return tracks.stream()
                .limit(CANDIDATE_COUNT)
                .map(track -> {
                    Map<String, Object> row = new LinkedHashMap<String, Object>();
                    row.put("title", track.title);
                    row.put("coverUrl", track.coverUrl);
                    return row;
                })
                .toList();
    }

    private void upsert(Long eventId, Long userId, String kind, List<String> titles, Event event) {
        SetlistSubmission submission = submissionRepository
                .findByUserIdAndEventIdAndKind(userId, eventId, kind)
                .orElseGet(() -> {
                    SetlistSubmission s = new SetlistSubmission();
                    s.setUser(userRepository.findById(userId)
                            .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId)));
                    s.setEvent(event);
                    s.setKind(kind);
                    return s;
                });
        submission.setTitles(String.join(SEPARATOR, titles));
        submissionRepository.save(submission);
    }

    private Event requireEventWithArtist(Long eventId) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Etkinlik bulunamadı: " + eventId));
        if (event.getArtist() == null || event.getArtist().getName() == null) {
            throw new IllegalArgumentException("Bu etkinliğin sanatçısı tanımlı değil");
        }
        return event;
    }

    private static List<String> cleanTitles(List<String> titles) {
        if (titles == null) return List.of();
        return titles.stream()
                .filter(Objects::nonNull)
                .map(t -> t.replace(SEPARATOR, " ").trim())
                .filter(t -> !t.isEmpty())
                .distinct()
                .toList();
    }

    private static List<String> split(String joined) {
        if (joined == null || joined.isEmpty()) return List.of();
        return Arrays.stream(joined.split("\\|")).filter(s -> !s.isBlank()).toList();
    }
}
