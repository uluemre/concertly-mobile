package com.concertly.backend.controller;

import com.concertly.backend.dto.request.CreateEventRequest;
import com.concertly.backend.dto.response.EventResponse;
import com.concertly.backend.dto.response.PostResponse;
import com.concertly.backend.dto.response.UserResponse;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.*;
import com.concertly.backend.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final UserRepository userRepository;
    private final EventRepository eventRepository;
    private final ArtistRepository artistRepository;
    private final VenueRepository venueRepository;
    private final RoleRepository roleRepository;
    private final EventAttendanceRepository eventAttendanceRepository;
    private final PostRepository postRepository;
    private final LikeRepository likeRepository;
    private final CommentRepository commentRepository;
    private final CommunityRepository communityRepository;
    private final FollowRepository followRepository;
    private final AccountDeletionFeedbackRepository deletionFeedbackRepository;

    public AdminController(UserRepository userRepository,
                           EventRepository eventRepository,
                           ArtistRepository artistRepository,
                           VenueRepository venueRepository,
                           RoleRepository roleRepository,
                           EventAttendanceRepository eventAttendanceRepository,
                           PostRepository postRepository,
                           LikeRepository likeRepository,
                           CommentRepository commentRepository,
                           CommunityRepository communityRepository,
                           FollowRepository followRepository,
                           AccountDeletionFeedbackRepository deletionFeedbackRepository) {
        this.userRepository = userRepository;
        this.eventRepository = eventRepository;
        this.artistRepository = artistRepository;
        this.venueRepository = venueRepository;
        this.roleRepository = roleRepository;
        this.eventAttendanceRepository = eventAttendanceRepository;
        this.postRepository = postRepository;
        this.likeRepository = likeRepository;
        this.commentRepository = commentRepository;
        this.communityRepository = communityRepository;
        this.followRepository = followRepository;
        this.deletionFeedbackRepository = deletionFeedbackRepository;
    }

    // ── STATS ──────────────────────────────────────────────────────────────────

    @GetMapping("/stats")
    public Map<String, Object> getStats() {
        long totalUsers = userRepository.count();
        long activeUsers = userRepository.findAll().stream()
            .filter(u -> Boolean.TRUE.equals(u.getIsActive())).count();
        long bannedUsers = totalUsers - activeUsers;
        long adminUsers = userRepository.findAll().stream()
            .filter(u -> u.getRoles() != null && u.getRoles().stream()
                .anyMatch(r -> "ROLE_ADMIN".equals(r.getName()))).count();

        long totalEvents = eventRepository.count();
        long approvedEvents = eventRepository.findByIsApproved(true).size();
        long pendingEvents = totalEvents - approvedEvents;

        long totalPosts = postRepository.count();
        long totalCommunities = communityRepository.count();
        long totalAttendance = eventAttendanceRepository.count();
        long totalFollows = followRepository.count();

        LocalDateTime sevenDaysAgo = LocalDateTime.now().minusDays(7);
        long newUsersThisWeek = userRepository.findAll().stream()
            .filter(u -> u.getCreatedAt() != null && u.getCreatedAt().isAfter(sevenDaysAgo)).count();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalUsers", totalUsers);
        stats.put("activeUsers", activeUsers);
        stats.put("bannedUsers", bannedUsers);
        stats.put("adminUsers", adminUsers);
        stats.put("newUsersThisWeek", newUsersThisWeek);
        stats.put("totalEvents", totalEvents);
        stats.put("approvedEvents", approvedEvents);
        stats.put("pendingEvents", pendingEvents);
        stats.put("totalPosts", totalPosts);
        stats.put("totalCommunities", totalCommunities);
        stats.put("totalAttendance", totalAttendance);
        stats.put("totalFollows", totalFollows);
        return stats;
    }

    // ── EVENTS ─────────────────────────────────────────────────────────────────

    @GetMapping("/events")
    public List<EventResponse> getEvents(@RequestParam(required = false) Boolean approved) {
        List<Event> events = approved != null
            ? eventRepository.findByIsApproved(approved)
            : eventRepository.findAll();
        events.sort(Comparator.comparing(Event::getEventDate));
        return events.stream().map(EventResponse::from).toList();
    }

    @PostMapping("/events")
    @ResponseStatus(HttpStatus.CREATED)
    public EventResponse createEvent(@RequestBody CreateEventRequest req) {
        Artist artist = resolveOrCreateArtist(req);
        Venue venue = resolveOrCreateVenue(req, null);

        Event event = new Event();
        event.setName(req.getName());
        event.setDescription(req.getDescription());
        event.setEventDate(req.getEventDate());
        event.setArtist(artist);
        event.setVenue(venue);
        event.setGenre(req.getArtistGenre() != null ? req.getArtistGenre() : artist.getGenre());
        event.setTicketUrl(req.getTicketUrl());
        event.setIsApproved(true);
        return EventResponse.from(eventRepository.save(event));
    }

    @PutMapping("/events/{id}")
    public EventResponse updateEvent(@PathVariable Long id, @RequestBody CreateEventRequest req) {
        Event event = eventRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Etkinlik bulunamadi: " + id));

        if (req.getName() != null) event.setName(req.getName());
        if (req.getDescription() != null) event.setDescription(req.getDescription());
        if (req.getEventDate() != null) event.setEventDate(req.getEventDate());
        if (req.getTicketUrl() != null) event.setTicketUrl(req.getTicketUrl());

        if (req.getArtistId() != null) {
            artistRepository.findById(req.getArtistId()).ifPresent(event::setArtist);
        } else if (req.getArtistName() != null) {
            event.setArtist(resolveOrCreateArtist(req));
            if (req.getArtistGenre() != null) event.setGenre(req.getArtistGenre());
        }

        if (req.getVenueId() != null) {
            venueRepository.findById(req.getVenueId()).ifPresent(event::setVenue);
        } else if (req.getVenueName() != null) {
            event.setVenue(resolveOrCreateVenue(req, event.getVenue()));
        }

        return EventResponse.from(eventRepository.save(event));
    }

    @PatchMapping("/events/{id}/approve")
    public EventResponse approveEvent(@PathVariable Long id) {
        Event event = eventRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Etkinlik bulunamadi: " + id));
        event.setIsApproved(true);
        return EventResponse.from(eventRepository.save(event));
    }

    @DeleteMapping("/events/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteEvent(@PathVariable Long id) {
        if (!eventRepository.existsById(id))
            throw new ResourceNotFoundException("Etkinlik bulunamadi: " + id);
        eventRepository.deleteById(id);
    }

    // ── POSTS ──────────────────────────────────────────────────────────────────

    @GetMapping("/posts")
    public List<PostResponse> getAllPosts() {
        return postRepository.findAll().stream()
            .sorted(Comparator.comparing(Post::getCreatedAt).reversed())
            .map(post -> {
                long likes = likeRepository.countByPostId(post.getId());
                long comments = commentRepository.countByPostId(post.getId());
                return PostResponse.from(post, likes, comments);
            })
            .collect(Collectors.toList());
    }

    @DeleteMapping("/posts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @org.springframework.transaction.annotation.Transactional
    public void deletePost(@PathVariable Long id) {
        if (!postRepository.existsById(id))
            throw new ResourceNotFoundException("Post bulunamadi: " + id);
        likeRepository.deleteByPostId(id);
        commentRepository.deleteByPostId(id);
        postRepository.deleteById(id);
    }

    // ── HESAP SİLME GERİ BİLDİRİMİ ───────────────────────────────────────────────

    // Kullanıcıların hesabını silerken verdiği sebepler (anonim), en yeni önce.
    @GetMapping("/deletion-feedback")
    public List<AccountDeletionFeedback> getDeletionFeedback() {
        return deletionFeedbackRepository.findAllByOrderByCreatedAtDesc();
    }

    // ── USERS ──────────────────────────────────────────────────────────────────

    @GetMapping("/users")
    public List<UserResponse> getAdminUsers() {
        return userRepository.findAll().stream()
            .map(this::buildUserResponse)
            .collect(Collectors.toList());
    }

    @PatchMapping("/users/{id}/ban")
    @org.springframework.transaction.annotation.Transactional
    public UserResponse banUser(@PathVariable Long id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi: " + id));
        user.setIsActive(false);
        return buildUserResponse(userRepository.save(user));
    }

    @PatchMapping("/users/{id}/unban")
    @org.springframework.transaction.annotation.Transactional
    public UserResponse unbanUser(@PathVariable Long id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi: " + id));
        user.setIsActive(true);
        return buildUserResponse(userRepository.save(user));
    }

    @PatchMapping("/users/{id}/make-admin")
    public UserResponse makeAdmin(@PathVariable Long id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi: " + id));
        Role adminRole = roleRepository.findByName("ROLE_ADMIN")
            .orElseThrow(() -> new ResourceNotFoundException("ROLE_ADMIN rolu bulunamadi"));
        if (user.getRoles() == null) user.setRoles(new HashSet<>());
        user.getRoles().add(adminRole);
        return buildUserResponse(userRepository.save(user));
    }

    @PatchMapping("/users/{id}/remove-admin")
    public UserResponse removeAdmin(@PathVariable Long id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi: " + id));
        if (user.getRoles() != null) {
            user.getRoles().removeIf(r -> "ROLE_ADMIN".equals(r.getName()));
        }
        return buildUserResponse(userRepository.save(user));
    }

    // ── HELPERS ────────────────────────────────────────────────────────────────

    private Artist resolveOrCreateArtist(CreateEventRequest req) {
        if (req.getArtistId() != null) {
            return artistRepository.findById(req.getArtistId())
                .orElseThrow(() -> new ResourceNotFoundException("Artist bulunamadi: " + req.getArtistId()));
        }
        Artist artist = new Artist();
        artist.setName(req.getArtistName() != null ? req.getArtistName() : "Bilinmeyen Sanatci");
        artist.setGenre(req.getArtistGenre() != null ? req.getArtistGenre() : "Diger");
        return artistRepository.save(artist);
    }

    private Venue resolveOrCreateVenue(CreateEventRequest req, Venue existing) {
        if (req.getVenueId() != null) {
            return venueRepository.findById(req.getVenueId())
                .orElseThrow(() -> new ResourceNotFoundException("Venue bulunamadi: " + req.getVenueId()));
        }
        Venue venue = existing != null ? existing : new Venue();
        if (req.getVenueName() != null) venue.setName(req.getVenueName());
        if (req.getVenueCity() != null) venue.setCity(req.getVenueCity());
        if (req.getVenueCountry() != null) venue.setCountry(req.getVenueCountry());
        if (req.getVenueAddress() != null) venue.setAddress(req.getVenueAddress());
        if (req.getVenueLatitude() != null) venue.setLatitude(req.getVenueLatitude());
        if (req.getVenueLongitude() != null) venue.setLongitude(req.getVenueLongitude());
        return venueRepository.save(venue);
    }

    private UserResponse buildUserResponse(User u) {
        long postCount = postRepository.countByUserId(u.getId());
        boolean isAdmin = u.getRoles() != null && u.getRoles().stream()
            .anyMatch(r -> "ROLE_ADMIN".equals(r.getName()));
        UserResponse resp = new UserResponse(u.getId(), u.getUsername(), u.getEmail(), u.getCity());
        resp.setIsActive(u.getIsActive());
        resp.setIsAdmin(isAdmin);
        resp.setPostCount((int) postCount);
        return resp;
    }
}
