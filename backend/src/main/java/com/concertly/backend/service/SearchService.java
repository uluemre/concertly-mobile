package com.concertly.backend.service;

import com.concertly.backend.dto.response.*;
import com.concertly.backend.repository.*;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SearchService {

    private final EventRepository eventRepository;
    private final ArtistRepository artistRepository;
    private final UserRepository userRepository;
    private final ArtistFollowRepository artistFollowRepository;

    public SearchService(EventRepository eventRepository,
            ArtistRepository artistRepository,
            UserRepository userRepository,
            ArtistFollowRepository artistFollowRepository) {
        this.eventRepository = eventRepository;
        this.artistRepository = artistRepository;
        this.userRepository = userRepository;
        this.artistFollowRepository = artistFollowRepository;
    }

    public SearchResponse search(String q, Long currentUserId) {
        if (q == null || q.trim().length() < 2) {
            return new SearchResponse(List.of(), List.of(), List.of());
        }

        String query = q.trim();

        List<EventResponse> events = eventRepository.search(query)
                .stream()
                .map(EventResponse::from)
                .toList();

        List<ArtistResponse> artists = artistRepository.search(query)
                .stream()
                .map(a -> {
                    long followerCount = artistFollowRepository.countByArtistId(a.getId());
                    boolean isFollowed = currentUserId != null &&
                            artistFollowRepository.findByUserIdAndArtistId(currentUserId, a.getId()).isPresent();
                    return ArtistResponse.from(a, followerCount, isFollowed);
                })
                .toList();

        List<UserResponse> users = userRepository.search(query)
                .stream()
                .map(u -> new UserResponse(u.getId(), u.getUsername(), u.getEmail()))
                .toList();

        return new SearchResponse(events, artists, users);
    }
}