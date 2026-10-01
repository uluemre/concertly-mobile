package com.concertly.backend.controller;

import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.ConcertBuddy;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.ConcertBuddyRepository;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.UserRepository;
import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.ModerationService;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Set;
import java.util.Map;

@RestController
@RequestMapping("/api/events/{eventId}/buddies")
public class ConcertBuddyController {

    private final ConcertBuddyRepository buddyRepository;
    private final EventRepository eventRepository;
    private final UserRepository userRepository;
    private final ModerationService moderationService;

    public ConcertBuddyController(ConcertBuddyRepository buddyRepository,
                                   EventRepository eventRepository,
                                   UserRepository userRepository,
                                   ModerationService moderationService) {
        this.buddyRepository = buddyRepository;
        this.eventRepository = eventRepository;
        this.userRepository = userRepository;
        this.moderationService = moderationService;
    }

    @GetMapping
    public List<Map<String, Object>> getBuddies(@PathVariable Long eventId) {
        Long viewerId = JwtUtil.getCurrentUserId();
        boolean anonymous = viewerId == null;
        Set<Long> hidden = moderationService.getHiddenUserIds(viewerId);
        return buddyRepository.findByEventIdOrderByCreatedAtDesc(eventId).stream()
                .filter(b -> !hidden.contains(b.getUser().getId()))
                .map(b -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("userId", b.getUser().getId());
                    m.put("username", b.getUser().getUsername());
                    m.put("profileImageUrl", b.getUser().getProfileImageUrl() != null ? b.getUser().getProfileImageUrl() : "");
                    // Şehir ve mesaj yalnızca giriş yapmış izleyiciye (SEC-04)
                    if (!anonymous) {
                        m.put("city", b.getUser().getCity() != null ? b.getUser().getCity() : "");
                        m.put("message", b.getMessage() != null ? b.getMessage() : "");
                    }
                    m.put("createdAt", b.getCreatedAt().toString());
                    return m;
                })
                .toList();
    }

    @PostMapping
    @Transactional
    public Map<String, Object> joinAsBuddy(
            @PathVariable Long eventId,
            @RequestBody(required = false) Map<String, String> body
    ) {
        Long userId = JwtUtil.getCurrentUserId();
        String message = body != null ? body.getOrDefault("message", null) : null;

        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Etkinlik bulunamadı: " + eventId));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId));

        ConcertBuddy buddy = buddyRepository.findByUserIdAndEventId(userId, eventId)
                .orElse(new ConcertBuddy());

        buddy.setUser(user);
        buddy.setEvent(event);
        if (message != null) buddy.setMessage(message.isBlank() ? null : message.trim());

        buddyRepository.save(buddy);
        return Map.of("joined", true);
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void leaveAsBuddy(@PathVariable Long eventId) {
        Long userId = JwtUtil.getCurrentUserId();
        buddyRepository.findByUserIdAndEventId(userId, eventId)
                .ifPresent(buddyRepository::delete);
    }

    @GetMapping("/me")
    public Map<String, Object> myStatus(@PathVariable Long eventId) {
        Long userId = JwtUtil.getCurrentUserId();
        // Giriş yapmamış izleyici için güvenli değer (GET /api/events/** herkese açık)
        if (userId == null) return Map.of("joined", false, "message", "");
        boolean joined = buddyRepository.existsByUserIdAndEventId(userId, eventId);
        String message = "";
        if (joined) {
            message = buddyRepository.findByUserIdAndEventId(userId, eventId)
                    .map(b -> b.getMessage() != null ? b.getMessage() : "")
                    .orElse("");
        }
        return Map.of("joined", joined, "message", message);
    }
}
