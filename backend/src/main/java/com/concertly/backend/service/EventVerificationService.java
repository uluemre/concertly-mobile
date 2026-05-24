package com.concertly.backend.service;

import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventVerification;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.EventVerificationRepository;
import com.concertly.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@Service
public class EventVerificationService {

    private final EventVerificationRepository verificationRepository;
    private final UserRepository userRepository;
    private final EventRepository eventRepository;

    public EventVerificationService(EventVerificationRepository verificationRepository,
                                    UserRepository userRepository,
                                    EventRepository eventRepository) {
        this.verificationRepository = verificationRepository;
        this.userRepository = userRepository;
        this.eventRepository = eventRepository;
    }

    public Map<String, Object> verify(Long userId, Long eventId) {
        if (verificationRepository.existsByUserIdAndEventId(userId, eventId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bu konser zaten doğrulandı.");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId));
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Etkinlik bulunamadı: " + eventId));

        EventVerification verification = new EventVerification();
        verification.setUser(user);
        verification.setEvent(event);
        verificationRepository.save(verification);

        return Map.of("verified", true, "eventId", eventId);
    }

    public Map<String, Object> getStatus(Long userId, Long eventId) {
        boolean verified = verificationRepository.existsByUserIdAndEventId(userId, eventId);
        return Map.of("verified", verified, "eventId", eventId);
    }
}
