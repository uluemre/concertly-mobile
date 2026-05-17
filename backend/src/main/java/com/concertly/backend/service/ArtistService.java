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
    private final SpotifyService         spotifyService;

    public ArtistService(ArtistRepository artistRepository,
                         ArtistFollowRepository artistFollowRepository,
                         UserRepository userRepository,
                         EventRepository eventRepository,
                         PostRepository postRepository,
                         LikeRepository likeRepository,
                         CommentRepository commentRepository,
                         SpotifyService spotifyService) {
        this.artistRepository       = artistRepository;
        this.artistFollowRepository = artistFollowRepository;
        this.userRepository         = userRepository;
        this.eventRepository        = eventRepository;
        this.postRepository         = postRepository;
        this.likeRepository         = likeRepository;
        this.commentRepository      = commentRepository;
        this.spotifyService         = spotifyService;
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

    public List<ArtistResponse> getArtistsByGenres(List<String> genres, Long currentUserId) {
        if (genres == null || genres.isEmpty()) {
            return List.of();
        }
        List<String> lowerGenres = genres.stream()
                .map(String::toLowerCase)
                .toList();
        return artistRepository.findByGenreIn(lowerGenres)
                .stream()
                .map(a -> {
                    long followerCount = artistFollowRepository.countByArtistId(a.getId());
                    boolean isFollowed = currentUserId != null &&
                            artistFollowRepository.findByUserIdAndArtistId(currentUserId, a.getId()).isPresent();
                    return ArtistResponse.from(a, followerCount, isFollowed);
                })
                .toList();
    }

    @Transactional
    public void bulkFollow(Long userId, List<Long> artistIds) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Kullanici bulunamadi: " + userId));

        for (Long artistId : artistIds) {
            Artist artist = artistRepository.findById(artistId)
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Sanatci bulunamadi: " + artistId));

            if (artistFollowRepository.findByUserIdAndArtistId(userId, artistId).isEmpty()) {
                ArtistFollow follow = new ArtistFollow();
                follow.setUser(user);
                follow.setArtist(artist);
                artistFollowRepository.save(follow);
            }
        }
    }

    @Transactional
    public int enrichAllArtists() {
        List<Artist> all = artistRepository.findAll();
        int enriched = 0;
        int skipped = 0;

        for (Artist a : all) {
            if (a.getImageUrl() != null && a.getGenre() != null && a.getSpotifyId() != null) {
                skipped++;
                continue;
            }

            // Spotify rate limit: saniyede ~3 istek
            try { Thread.sleep(350); } catch (InterruptedException e) { Thread.currentThread().interrupt(); break; }

            System.out.println("🎵 Zenginlestiriliyor: " + a.getName());
            SpotifyService.SpotifyArtistData sd = spotifyService.searchArtist(a.getName());
            if (sd != null) {
                if (a.getImageUrl() == null && sd.imageUrl != null) a.setImageUrl(sd.imageUrl);
                if (a.getGenre() == null && sd.genre != null) a.setGenre(sd.genre);
                if (a.getSpotifyId() == null && sd.spotifyId != null) a.setSpotifyId(sd.spotifyId);
                enriched++;
                System.out.println("  ✅ image=" + (sd.imageUrl != null) + " genre=" + sd.genre);
            }
        }

        artistRepository.saveAll(all);
        System.out.println("📊 " + enriched + " zenginlestirildi, " + skipped + " zaten tamdi");
        return enriched;
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