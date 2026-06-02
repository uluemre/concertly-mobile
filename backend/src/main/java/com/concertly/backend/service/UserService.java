package com.concertly.backend.service;

import com.concertly.backend.dto.request.UpdateProfileRequest;
import com.concertly.backend.dto.response.EventResponse;
import com.concertly.backend.dto.response.PassportResponse;
import com.concertly.backend.dto.response.PassportResponse.PassportEventDto;
import com.concertly.backend.dto.response.PostResponse;
import com.concertly.backend.dto.response.UserResponse;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.AttendanceStatus;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventAttendance;
import com.concertly.backend.model.Post;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.CommentRepository;
import com.concertly.backend.repository.EventAttendanceRepository;
import com.concertly.backend.repository.EventVerificationRepository;
import com.concertly.backend.repository.LikeRepository;
import com.concertly.backend.repository.PostRepository;
import com.concertly.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PostRepository postRepository;
    private final LikeRepository likeRepository;
    private final CommentRepository commentRepository;
    private final EventAttendanceRepository attendanceRepository;
    private final EventVerificationRepository verificationRepository;

    public UserService(UserRepository userRepository,
            PostRepository postRepository,
            LikeRepository likeRepository,
            CommentRepository commentRepository,
            EventAttendanceRepository attendanceRepository,
            EventVerificationRepository verificationRepository) {
        this.userRepository       = userRepository;
        this.postRepository       = postRepository;
        this.likeRepository       = likeRepository;
        this.commentRepository    = commentRepository;
        this.attendanceRepository = attendanceRepository;
        this.verificationRepository = verificationRepository;
    }

    // 🔥 CORE METHOD (eksik olan buydu)
    private PostResponse toResponse(Post post) {
        long likes = likeRepository.countByPostId(post.getId());
        long comments = commentRepository.countByPostId(post.getId());
        return PostResponse.from(post, likes, comments);
    }

    public List<UserResponse> getUsers() {
        return userRepository.findAll()
                .stream()
                .map(u -> new UserResponse(u.getId(), u.getUsername(), u.getEmail()))
                .toList();
    }

    public UserResponse getUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Kullanıcı bulunamadı: " + id));
        return new UserResponse(user.getId(), user.getUsername(), user.getEmail());
    }

    // ✅ PROFİL GÜNCELLE
    @Transactional
    public UserResponse updateProfile(Long id, UpdateProfileRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Kullanıcı bulunamadı: " + id));

        if (request.getBio() != null) {
            user.setBio(request.getBio());
        }
        if (request.getProfileImageUrl() != null) {
            user.setProfileImageUrl(request.getProfileImageUrl());
        }
        if (request.getCity() != null) {
            user.setCity(request.getCity());
        }
        if (request.getUsername() != null && !request.getUsername().isEmpty()) {
            user.setUsername(request.getUsername());
        }
        if (request.getEmail() != null && !request.getEmail().isEmpty()) {
            user.setEmail(request.getEmail());
        }
        if (request.getPhone() != null && !request.getPhone().isEmpty()) {
            user.setPhone(request.getPhone());
        }

        user.setUpdatedAt(LocalDateTime.now());
        User saved = userRepository.save(user);
        return new UserResponse(saved.getId(), saved.getUsername(), saved.getEmail(), saved.getCity());
    }

    // ✅ KULLANICININ POSTLARI
    public List<PostResponse> getUserPosts(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId);
        }

        return postRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    // ✅ KULLANICININ ETKİNLİKLERİ
    public List<EventResponse> getUserEvents(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId);
        }

        return postRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(Post::getEvent)
                .filter(event -> event != null)
                .distinct()
                .map(EventResponse::from)
                .toList();
    }

    // ✅ KONSER PASAPORTU
    public PassportResponse getUserPassport(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId);
        }

        LocalDateTime now = LocalDateTime.now();

        // Geçmiş GOING etkinlikler
        List<EventAttendance> goingAttendances = attendanceRepository
                .findByUserIdAndStatus(userId, AttendanceStatus.GOING)
                .stream()
                .filter(a -> a.getEvent() != null && a.getEvent().getEventDate().isBefore(now))
                .sorted((a, b) -> b.getEvent().getEventDate().compareTo(a.getEvent().getEventDate()))
                .toList();

        // Doğrulanmış event id seti
        Set<Long> verifiedIds = verificationRepository.findByUserId(userId)
                .stream()
                .map(v -> v.getEvent().getId())
                .collect(Collectors.toSet());

        // İstatistikler
        int totalConcerts    = goingAttendances.size();
        int verifiedConcerts = (int) goingAttendances.stream()
                .filter(a -> verifiedIds.contains(a.getEvent().getId()))
                .count();

        Set<String> artistNames = goingAttendances.stream()
                .map(a -> a.getEvent().getArtist() != null ? a.getEvent().getArtist().getName() : null)
                .filter(name -> name != null)
                .collect(Collectors.toSet());

        Set<String> cities = goingAttendances.stream()
                .map(a -> a.getEvent().getVenue() != null ? a.getEvent().getVenue().getCity() : null)
                .filter(city -> city != null)
                .collect(Collectors.toSet());

        // Yıl bazlı dağılım
        Map<String, Long> byYear = goingAttendances.stream()
                .collect(Collectors.groupingBy(
                        a -> String.valueOf(a.getEvent().getEventDate().getYear()),
                        Collectors.counting()
                ));

        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

        List<PassportEventDto> events = goingAttendances.stream()
                .map(a -> {
                    Event e = a.getEvent();
                    String img = (e.getArtist() != null && e.getArtist().getImageUrl() != null)
                            ? e.getArtist().getImageUrl() : e.getImageUrl();
                    return new PassportEventDto(
                            e.getId(),
                            e.getName(),
                            e.getEventDate().format(fmt),
                            e.getArtist() != null ? e.getArtist().getName() : null,
                            e.getVenue() != null ? e.getVenue().getCity() : null,
                            img,
                            e.getGenre(),
                            verifiedIds.contains(e.getId())
                    );
                })
                .toList();

        return new PassportResponse(totalConcerts, verifiedConcerts,
                artistNames.size(), cities.size(), byYear, events);
    }
}