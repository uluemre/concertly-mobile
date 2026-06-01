package com.concertly.backend.controller;

import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.ConcertBuddy;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.ConcertBuddyRepository;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.UserRepository;
import com.concertly.backend.security.JwtUtil;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/events/{eventId}/buddies")
public class ConcertBuddyController {

    private final ConcertBuddyRepository buddyRepository;
    private final EventRepository eventRepository;
    private final UserRepository userRepository;

    public ConcertBuddyController(ConcertBuddyRepository buddyRepository,
                                   EventRepository eventRepository,
                                   UserRepository userRepository) {
        this.buddyRepository = buddyRepository;
        this.eventRepository = eventRepository;
        this.userRepository = userRepository;
    }

    @GetMapping
    public List<Map<String, Object>> getBuddies(@PathVariable Long eventId) {
        return buddyRepository.findByEventIdOrderByCreatedAtDesc(eventId).stream()
                .map(b -> Map.<String, Object>of(
                        "userId", b.getUser().getId(),
                        "username", b.getUser().getUsername(),
                        "city", b.getUser().getCity() != null ? b.getUser().getCity() : "",
                        "profileImageUrl", b.getUser().getProfileImageUrl() != null ? b.getUser().getProfileImageUrl() : "",
                        "message", b.getMessage() != null ? b.getMessage() : "",
                        "createdAt", b.getCreatedAt().toString()
                ))
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
