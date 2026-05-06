package com.concertly.backend.service;

import com.concertly.backend.dto.request.UpdateProfileRequest;
import com.concertly.backend.dto.response.EventResponse;
import com.concertly.backend.dto.response.PostResponse;
import com.concertly.backend.dto.response.UserResponse;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Post;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.CommentRepository;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.LikeRepository;
import com.concertly.backend.repository.PostRepository;
import com.concertly.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PostRepository postRepository;
    private final EventRepository eventRepository;

    // 🔥 YENİ EKLEDİK (çok kritik)
    private final LikeRepository likeRepository;
    private final CommentRepository commentRepository;

    public UserService(UserRepository userRepository,
            PostRepository postRepository,
            EventRepository eventRepository,
            LikeRepository likeRepository,
            CommentRepository commentRepository) {
        this.userRepository = userRepository;
        this.postRepository = postRepository;
        this.eventRepository = eventRepository;
        this.likeRepository = likeRepository;
        this.commentRepository = commentRepository;
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
        if (request.getPhone() != null) {
            user.setPhone(request.getPhone());
        }

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
}