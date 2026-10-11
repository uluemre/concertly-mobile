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
import com.concertly.backend.service.PrivacyService;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

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
    private final PrivacyService privacyService;

    public ConcertBuddyController(ConcertBuddyRepository buddyRepository,
                                   EventRepository eventRepository,
                                   UserRepository userRepository,
                                   ModerationService moderationService,
                                   PrivacyService privacyService) {
        this.buddyRepository = buddyRepository;
        this.eventRepository = eventRepository;
        this.userRepository = userRepository;
        this.moderationService = moderationService;
        this.privacyService = privacyService;
    }

    /**
     * Giriş zorunlu (güvenlik katmanı 401 döner; burada da savunma amaçlı). Engelli/yasaklı ve
     * pasif hesaplar süzülür; gizli hesabın şehri ve mesajı yalnız onaylı takipçiye/kendisine/admine.
     */
    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getBuddies(@PathVariable Long eventId) {
        Long viewerId = JwtUtil.getCurrentUserId();
        if (viewerId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Giriş gerekli.");
        }
        Set<Long> hidden = moderationService.getHiddenUserIds(viewerId);
        List<ConcertBuddy> rows = buddyRepository.findByEventIdOrderByCreatedAtDesc(eventId).stream()
                .filter(b -> !hidden.contains(b.getUser().getId()))
                .filter(b -> !Boolean.FALSE.equals(b.getUser().getIsActive()))
                .toList();
        Set<Long> restricted = privacyService.restrictedOwnerIds(viewerId,
                rows.stream().map(ConcertBuddy::getUser).toList());
        return rows.stream()
                .map(b -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("userId", b.getUser().getId());
                    m.put("username", b.getUser().getUsername());
                    m.put("profileImageUrl", b.getUser().getProfileImageUrl() != null ? b.getUser().getProfileImageUrl() : "");
                    boolean limited = restricted.contains(b.getUser().getId());
                    m.put("city", !limited && b.getUser().getCity() != null ? b.getUser().getCity() : "");
                    m.put("message", !limited && b.getMessage() != null ? b.getMessage() : "");
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
        // İptal edilmiş / listelenmeyen / birleştirilmiş / geçmiş konserde arkadaş aranmaz
        if (!event.listedPublicly() || event.getMergedIntoEventId() != null
                || event.getEventDate() == null || !event.getEventDate().isAfter(java.time.LocalDateTime.now())) {
            throw new IllegalArgumentException("EVENT_NOT_JOINABLE");
        }
        // Sütun 200 karakter: uzun mesaj kesilir (eskiden veritabanı hatası veriyordu)
        if (message != null && message.trim().length() > 200) message = message.trim().substring(0, 200);

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
