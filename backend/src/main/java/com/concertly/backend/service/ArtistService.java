package com.concertly.backend.service;

import com.concertly.backend.dto.response.ArtistResponse;
import com.concertly.backend.dto.response.EventResponse;
import com.concertly.backend.dto.response.PostResponse;
import com.concertly.backend.exception.AlreadyExistsException;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Artist;
import com.concertly.backend.model.ArtistFollow;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ArtistService {

    private final ArtistRepository       artistRepository;
    private final ArtistFollowRepository artistFollowRepository;
    private final UserRepository         userRepository;
    private final EventRepository        eventRepository;
    private final PostRepository         postRepository;
    private final LikeRepository         likeRepository;
    private final CommentRepository      commentRepository;

    public ArtistService(ArtistRepository artistRepository,
                         ArtistFollowRepository artistFollowRepository,
                         UserRepository userRepository,
                         EventRepository eventRepository,
                         PostRepository postRepository,
                         LikeRepository likeRepository,
                         CommentRepository commentRepository) {
        this.artistRepository       = artistRepository;
        this.artistFollowRepository = artistFollowRepository;
        this.userRepository         = userRepository;
        this.eventRepository        = eventRepository;
        this.postRepository         = postRepository;
        this.likeRepository         = likeRepository;
        this.commentRepository      = commentRepository;
    }

    // ✅ SANATÇI PROFİLİ
    public ArtistResponse getArtist(Long artistId, Long currentUserId) {
        Artist artist = artistRepository.findById(artistId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Sanatçı bulunamadı: " + artistId));

        long followerCount = artistFollowRepository.countByArtistId(artistId);
        boolean isFollowed = currentUserId != null &&
                artistFollowRepository.findByUserIdAndArtistId(currentUserId, artistId).isPresent();

        return ArtistResponse.from(artist, followerCount, isFollowed);
    }

    // ✅ SANATÇININ ETKİNLİKLERİ
    public List<EventResponse> getArtistEvents(Long artistId) {
        if (!artistRepository.existsById(artistId)) {
            throw new ResourceNotFoundException("Sanatçı bulunamadı: " + artistId);
        }
        return eventRepository.findByArtistIdOrderByEventDateDesc(artistId)
                .stream()
                .map(EventResponse::from)
                .toList();
    }

    // ✅ SANATÇININ ETKİNLİKLERİNE AIT POSTLAR
    public List<PostResponse> getArtistPosts(Long artistId) {
        if (!artistRepository.existsById(artistId)) {
            throw new ResourceNotFoundException("Sanatçı bulunamadı: " + artistId);
        }
        return postRepository.findByEventArtistIdOrderByCreatedAtDesc(artistId)
                .stream()
                .map(post -> {
                    long likes    = likeRepository.countByPostId(post.getId());
                    long comments = commentRepository.countByPostId(post.getId());
                    return PostResponse.from(post, likes, comments);
                })
                .toList();
    }

    // ✅ TAKİP ET
    @Transactional
    public void follow(Long userId, Long artistId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Kullanıcı bulunamadı: " + userId));
        Artist artist = artistRepository.findById(artistId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Sanatçı bulunamadı: " + artistId));

        if (artistFollowRepository.findByUserIdAndArtistId(userId, artistId).isPresent()) {
            throw new AlreadyExistsException("Bu sanatçıyı zaten takip ediyorsunuz.");
        }

        ArtistFollow follow = new ArtistFollow();
        follow.setUser(user);
        follow.setArtist(artist);
        artistFollowRepository.save(follow);
    }

    // ✅ TAKİBİ BIRAK
    @Transactional
    public void unfollow(Long userId, Long artistId) {
        ArtistFollow follow = artistFollowRepository
                .findByUserIdAndArtistId(userId, artistId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Bu sanatçıyı zaten takip etmiyorsunuz."));
        artistFollowRepository.delete(follow);
    }
}