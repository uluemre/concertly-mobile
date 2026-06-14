package com.concertly.backend.controller;

import com.concertly.backend.model.AttendanceStatus;
import com.concertly.backend.model.BuddySwipe;
import com.concertly.backend.model.EventAttendance;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.BuddySwipeRepository;
import com.concertly.backend.repository.EventAttendanceRepository;
import com.concertly.backend.repository.UserRepository;
import com.concertly.backend.security.JwtUtil;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/buddy")
public class BuddyMatchController {

    private final EventAttendanceRepository attendanceRepository;
    private final BuddySwipeRepository swipeRepository;
    private final UserRepository userRepository;

    public BuddyMatchController(EventAttendanceRepository attendanceRepository,
                                BuddySwipeRepository swipeRepository,
                                UserRepository userRepository) {
        this.attendanceRepository = attendanceRepository;
        this.swipeRepository = swipeRepository;
        this.userRepository = userRepository;
    }

    // ── Kart listesi: aynı konserlere giden, henüz swipe edilmemiş kullanıcılar ──
    @GetMapping("/discover")
    public List<Map<String, Object>> discover() {
        Long myId = JwtUtil.getCurrentUserId();

        // Benim gideceğim yaklaşan etkinlikler
        List<EventAttendance> myAttendances = attendanceRepository
                .findAll().stream()
                .filter(ea -> ea.getUser().getId().equals(myId)
                        && ea.getStatus() == AttendanceStatus.GOING
                        && ea.getEvent().getEventDate().isAfter(LocalDateTime.now()))
                .toList();

        if (myAttendances.isEmpty()) return List.of();

        Set<Long> myEventIds = myAttendances.stream()
                .map(ea -> ea.getEvent().getId())
                .collect(Collectors.toSet());

        // Zaten swipe ettiğim kullanıcılar
        Set<Long> alreadySwiped = swipeRepository.findBySwiperId(myId).stream()
                .map(BuddySwipe::getTargetId)
                .collect(Collectors.toSet());
        alreadySwiped.add(myId); // kendimi de dışla

        // Aynı etkinliklere giden diğer kullanıcılar → kandidat listesi
        Map<Long, Map<String, Object>> candidates = new LinkedHashMap<>();

        for (EventAttendance ea : attendanceRepository.findAll()) {
            if (ea.getStatus() != AttendanceStatus.GOING) continue;
            if (!myEventIds.contains(ea.getEvent().getId())) continue;
            if (ea.getEvent().getEventDate().isBefore(LocalDateTime.now())) continue;

            Long candidateId = ea.getUser().getId();
            if (alreadySwiped.contains(candidateId)) continue;

            candidates.computeIfAbsent(candidateId, id -> {
                User u = ea.getUser();
                Map<String, Object> card = new LinkedHashMap<>();
                card.put("userId", u.getId());
                card.put("username", u.getUsername());
                card.put("city", u.getCity() != null ? u.getCity() : "");
                card.put("bio", u.getBio() != null ? u.getBio() : "");
                card.put("favoriteGenres", u.getFavoriteGenres() != null ? u.getFavoriteGenres() : "");
                card.put("profileImageUrl", u.getProfileImageUrl() != null ? u.getProfileImageUrl() : "");
                card.put("sharedEvents", new ArrayList<>());
                return card;
            });

            // Ortak etkinliği ekle
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> sharedEvents =
                    (List<Map<String, Object>>) candidates.get(candidateId).get("sharedEvents");
            sharedEvents.add(Map.of(
                    "id", ea.getEvent().getId(),
                    "name", ea.getEvent().getName(),
                    "artistName", ea.getEvent().getArtist() != null ? ea.getEvent().getArtist().getName() : "",
                    "eventDate", ea.getEvent().getEventDate().toString()
            ));
        }

        // Tür uyumu hesapla
        String myGenres = userRepository.findById(myId)
                .map(u -> u.getFavoriteGenres() != null ? u.getFavoriteGenres() : "")
                .orElse("");
        Set<String> myGenreSet = Arrays.stream(myGenres.split(","))
                .map(String::trim).filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());

        candidates.values().forEach(card -> {
            String theirGenres = (String) card.get("favoriteGenres");
            Set<String> theirGenreSet = Arrays.stream(theirGenres.split(","))
                    .map(String::trim).filter(s -> !s.isEmpty())
                    .collect(Collectors.toSet());

            int score = 0;
            if (!myGenreSet.isEmpty() && !theirGenreSet.isEmpty()) {
                Set<String> intersection = new HashSet<>(myGenreSet);
                intersection.retainAll(theirGenreSet);
                Set<String> union = new HashSet<>(myGenreSet);
                union.addAll(theirGenreSet);
                score = (int) Math.round((double) intersection.size() / union.size() * 100);
            }
            card.put("genreMatchScore", score);
        });

        // En fazla ortak etkinliği olana göre sırala
        return candidates.values().stream()
                .sorted(Comparator.comparingInt(c -> -((List<?>) c.get("sharedEvents")).size()))
                .limit(30)
                .collect(Collectors.toList());
    }

    // ── Swipe: beğen veya geç ──
    @PostMapping("/swipe")
    @Transactional
    public Map<String, Object> swipe(@RequestBody Map<String, Object> body) {
        Long myId = JwtUtil.getCurrentUserId();
        Long targetId = Long.valueOf(body.get("targetId").toString());
        boolean liked = Boolean.parseBoolean(body.get("liked").toString());

        BuddySwipe swipe = swipeRepository.findBySwiperIdAndTargetId(myId, targetId)
                .orElse(new BuddySwipe());
        swipe.setSwiperId(myId);
        swipe.setTargetId(targetId);
        swipe.setLiked(liked);
        swipeRepository.save(swipe);

        // Eşleşme kontrolü: karşı taraf beni beğendiyse → match!
        boolean matched = liked && swipeRepository.existsBySwiperIdAndTargetIdAndLikedTrue(targetId, myId);

        Map<String, Object> result = new HashMap<>();
        result.put("matched", matched);
        if (matched) {
            userRepository.findById(targetId).ifPresent(u -> {
                result.put("matchedUser", Map.of(
                        "userId", u.getId(),
                        "username", u.getUsername(),
                        "profileImageUrl", u.getProfileImageUrl() != null ? u.getProfileImageUrl() : ""
                ));
            });
        }
        return result;
    }

    // ── Eşleşmeler ──
    @GetMapping("/matches")
    public List<Map<String, Object>> getMatches() {
        Long myId = JwtUtil.getCurrentUserId();

        // Benim beğendiklerim
        Set<Long> iLiked = swipeRepository.findBySwiperId(myId).stream()
                .filter(BuddySwipe::isLiked)
                .map(BuddySwipe::getTargetId)
                .collect(Collectors.toSet());

        // Beni beğenenler
        return swipeRepository.findAll().stream()
                .filter(s -> s.getTargetId().equals(myId) && s.isLiked() && iLiked.contains(s.getSwiperId()))
                .map(s -> {
                    Map<String, Object> match = new LinkedHashMap<>();
                    userRepository.findById(s.getSwiperId()).ifPresent(u -> {
                        match.put("userId", u.getId());
                        match.put("username", u.getUsername());
                        match.put("city", u.getCity() != null ? u.getCity() : "");
                        match.put("profileImageUrl", u.getProfileImageUrl() != null ? u.getProfileImageUrl() : "");
                        match.put("favoriteGenres", u.getFavoriteGenres() != null ? u.getFavoriteGenres() : "");
                        // Hangi konser(ler) sayesinde eşleştiler — ortak yaklaşan "Gidiyorum" etkinlikleri
                        match.put("sharedEvents", sharedEventsBetween(myId, u.getId()));
                    });
                    return match;
                })
                .filter(m -> !m.isEmpty())
                .collect(Collectors.toList());
    }

    /** İki kullanıcının ortak yaklaşan "Gidiyorum" etkinlikleri (eşleşme sebebi). */
    private List<Map<String, Object>> sharedEventsBetween(Long aId, Long bId) {
        LocalDateTime now = LocalDateTime.now();
        Set<Long> aEventIds = attendanceRepository.findByUserIdAndStatus(aId, AttendanceStatus.GOING).stream()
                .map(EventAttendance::getEvent)
                .filter(e -> e.getEventDate() != null && e.getEventDate().isAfter(now))
                .map(e -> e.getId())
                .collect(Collectors.toSet());
        if (aEventIds.isEmpty()) return List.of();
        return attendanceRepository.findByUserIdAndStatus(bId, AttendanceStatus.GOING).stream()
                .map(EventAttendance::getEvent)
                .filter(e -> e.getEventDate() != null && e.getEventDate().isAfter(now) && aEventIds.contains(e.getId()))
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", e.getId());
                    m.put("name", e.getName());
                    m.put("artistName", e.getArtist() != null ? e.getArtist().getName() : "");
                    m.put("eventDate", e.getEventDate().toString());
                    return m;
                })
                .collect(Collectors.toList());
    }
}
