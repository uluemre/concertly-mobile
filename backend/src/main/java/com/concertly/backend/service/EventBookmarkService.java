package com.concertly.backend.service;

import com.concertly.backend.dto.response.EventResponse;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventBookmark;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.EventBookmarkRepository;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class EventBookmarkService {

    private final EventBookmarkRepository bookmarkRepository;
    private final UserRepository userRepository;
    private final EventRepository eventRepository;

    public EventBookmarkService(EventBookmarkRepository bookmarkRepository,
                                UserRepository userRepository,
                                EventRepository eventRepository) {
        this.bookmarkRepository = bookmarkRepository;
        this.userRepository = userRepository;
        this.eventRepository = eventRepository;
    }

    public boolean toggleBookmark(Long userId, Long eventId) {
        bookmarkRepository.findByUserIdAndEventId(userId, eventId).ifPresentOrElse(
            bookmarkRepository::delete,
            () -> {
                User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId));
                Event event = eventRepository.findById(eventId)
                    .orElseThrow(() -> new ResourceNotFoundException("Etkinlik bulunamadı: " + eventId));
                EventBookmark bookmark = new EventBookmark();
                bookmark.setUser(user);
                bookmark.setEvent(event);
                bookmarkRepository.save(bookmark);
            }
        );
        return bookmarkRepository.existsByUserIdAndEventId(userId, eventId);
    }

    public boolean isBookmarked(Long userId, Long eventId) {
        return bookmarkRepository.existsByUserIdAndEventId(userId, eventId);
    }

    public List<EventResponse> getUserBookmarks(Long userId) {
        return bookmarkRepository.findAllByUserIdOrderByCreatedAtDesc(userId)
            .stream()
            .map(b -> EventResponse.from(b.getEvent()))
            .collect(Collectors.toList());
    }
}
