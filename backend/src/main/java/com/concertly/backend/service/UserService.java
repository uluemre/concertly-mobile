package com.concertly.backend.service;

import com.concertly.backend.dto.request.UpdateProfileRequest;
import com.concertly.backend.dto.response.BadgeResponse;
import com.concertly.backend.dto.response.EventResponse;
import com.concertly.backend.dto.response.PassportResponse;
import com.concertly.backend.dto.response.PassportResponse.PassportEventDto;
import com.concertly.backend.dto.response.PassportResponse.TopArtistDto;
import com.concertly.backend.dto.response.PassportResponse.TopGenreDto;
import com.concertly.backend.dto.request.PrivacySettingsRequest;
import com.concertly.backend.dto.response.PostResponse;
import com.concertly.backend.dto.response.PrivacySettingsResponse;
import com.concertly.backend.dto.response.UserResponse;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.Post;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.BingoCardRepository;
import com.concertly.backend.repository.CommentRepository;
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
    private final EventVerificationRepository verificationRepository;
    private final BingoCardRepository bingoCardRepository;
    private final BadgeService badgeService;
    private final ConcertAttendanceService concertAttendance;

    public UserService(UserRepository userRepository,
            PostRepository postRepository,
            LikeRepository likeRepository,
            CommentRepository commentRepository,
            EventVerificationRepository verificationRepository,
            BingoCardRepository bingoCardRepository,
            BadgeService badgeService,
            ConcertAttendanceService concertAttendance) {
        this.userRepository       = userRepository;
        this.postRepository       = postRepository;
        this.likeRepository       = likeRepository;
        this.commentRepository    = commentRepository;
        this.verificationRepository = verificationRepository;
        this.bingoCardRepository  = bingoCardRepository;
        this.badgeService         = badgeService;
        this.concertAttendance    = concertAttendance;
    }

    // 🔥 CORE METHOD — like/comment sayımlarını + izleyenin beğenilerini toplu çeker (N+1 yok)
    private List<PostResponse> toResponses(List<Post> posts, Long currentUserId) {
        if (posts.isEmpty()) return List.of();
        List<Long> ids = posts.stream().map(Post::getId).toList();
        Map<Long, Long> likeCounts = likeRepository.countByPostIdIn(ids).stream()
                .collect(Collectors.toMap(r -> (Long) r[0], r -> (Long) r[1]));
        Map<Long, Long> commentCounts = commentRepository.countByPostIdIn(ids).stream()
                .collect(Collectors.toMap(r -> (Long) r[0], r -> (Long) r[1]));
        Set<Long> likedPostIds = currentUserId == null
                ? Set.of()
                : Set.copyOf(likeRepository.findLikedPostIds(currentUserId, ids));
        return posts.stream()
                .map(p -> {
                    PostResponse dto = PostResponse.from(p,
                            likeCounts.getOrDefault(p.getId(), 0L),
                            commentCounts.getOrDefault(p.getId(), 0L));
                    dto.setLikedByMe(likedPostIds.contains(p.getId()));
                    return dto;
                })
                .toList();
    }

    // E-posta dönülmez: bu uçlar tüm giriş yapmış kullanıcılara açık (admin listesi
    // ayrı /api/admin/users'tır). E-posta sızıntısını önlemek için null bırakılır.
    public List<UserResponse> getUsers() {
        return userRepository.findAll()
                .stream()
                .map(u -> new UserResponse(u.getId(), u.getUsername(), null))
                .toList();
    }

    public UserResponse getUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Kullanıcı bulunamadı: " + id));
        return new UserResponse(user.getId(), user.getUsername(), null);
    }

    /**
     * Kullanıcı adından profil çözümler. Paylaşılan /u/{kullanıcıadı} linki
     * uygulamada açıldığında ekranın hangi id'yi yükleyeceğini bulmak için.
     */
    public UserResponse getUserByUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Kullanıcı bulunamadı: " + username));
        return new UserResponse(user.getId(), user.getUsername(), null);
    }

    // ── GİZLİLİK AYARLARI ─────────────────────────────────────────────────────

    public PrivacySettingsResponse getPrivacySettings(Long userId) {
        return PrivacySettingsResponse.from(userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId)));
    }

    @Transactional
    public PrivacySettingsResponse updatePrivacySettings(Long userId, PrivacySettingsRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId));
        if (request != null) {
            if (request.getMessagePrivacy() != null) user.setMessagePrivacy(request.getMessagePrivacy());
            if (request.getPrivateAccount() != null) user.setPrivateAccount(request.getPrivateAccount());
            userRepository.save(user);
        }
        return PrivacySettingsResponse.from(user);
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
    public List<PostResponse> getUserPosts(Long userId, Long currentUserId) {
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId);
        }

        // Moderasyonca gizlenen paylaşımlar profilde de görünmez
        return toResponses(postRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .filter(p -> !p.getIsHidden())
                .toList(), currentUserId);
    }

    // ✅ KULLANICININ KONSERLERİ — katıldığı (geçmiş "Gidiyorum") konserler, en yeni önce.
    // Profil sayısı ve Pasaport aynı tanımı kullanır (ConcertAttendanceService).
    // Eskiden gönderi atılan etkinlikleri sayıyordu; ayrıca Post.event tembel
    // yüklendiği için konsere bağlı gönderisi olan kullanıcılarda 500 veriyordu.
    @Transactional(readOnly = true)
    public List<EventResponse> getUserEvents(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId);
        }
        return concertAttendance.attended(userId).stream()
                .map(EventResponse::from)
                .toList();
    }

    // ✅ KONSER PASAPORTU
    public PassportResponse getUserPassport(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId);
        }

        // Katıldığı konserler (geçmiş "Gidiyorum"), en yeni önce — profil ve rozetlerle aynı tanım
        List<Event> attended = concertAttendance.attended(userId);

        // Doğrulanmış event id seti
        Set<Long> verifiedIds = verificationRepository.findByUserId(userId)
                .stream()
                .map(v -> v.getEvent().getId())
                .collect(Collectors.toSet());

        // İstatistikler
        int totalConcerts    = attended.size();
        int verifiedConcerts = (int) attended.stream()
                .filter(e -> verifiedIds.contains(e.getId()))
                .count();

        Set<String> artistNames = attended.stream()
                .map(e -> e.getArtist() != null ? e.getArtist().getName() : null)
                .filter(name -> name != null)
                .collect(Collectors.toSet());

        // "Istanbul" ve "İstanbul" tek şehir sayılır
        int cityCount = ConcertAttendanceService.countCities(attended);

        // Yıl bazlı dağılım
        Map<String, Long> byYear = attended.stream()
                .collect(Collectors.groupingBy(
                        e -> String.valueOf(e.getEventDate().getYear()),
                        Collectors.counting()
                ));

        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

        List<PassportEventDto> events = attended.stream()
                .map(e -> {
                    String img = (e.getArtist() != null && e.getArtist().getImageUrl() != null)
                            ? e.getArtist().getImageUrl() : e.getImageUrl();
                    return new PassportEventDto(
                            e.getId(),
                            e.getName(),
                            e.getEventDate().format(fmt),
                            e.getArtist() != null ? e.getArtist().getId() : null,
                            e.getArtist() != null ? e.getArtist().getName() : null,
                            e.getVenue() != null ? e.getVenue().getCity() : null,
                            img,
                            e.getGenre(),
                            verifiedIds.contains(e.getId())
                    );
                })
                .toList();

        Set<Long> bingoEventIds = bingoCardRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .filter(c -> c.isHasBingo() && c.getEventId() != null)
                .map(c -> c.getEventId())
                .collect(Collectors.toSet());

        // Top sanatçılar (en çok gidilen, max 5) — ID ve isim birlikte
        Map<Long, String> topArtistNames  = new java.util.HashMap<>();
        Map<Long, Long>   topArtistCounts = new java.util.HashMap<>();
        attended.stream()
                .filter(e -> e.getArtist() != null && e.getArtist().getName() != null)
                .forEach(e -> {
                    Long   id   = e.getArtist().getId();
                    String name = e.getArtist().getName();
                    topArtistNames.putIfAbsent(id, name);
                    topArtistCounts.merge(id, 1L, Long::sum);
                });
        List<TopArtistDto> topArtists = topArtistCounts.entrySet().stream()
                .sorted(Map.Entry.<Long, Long>comparingByValue().reversed())
                .limit(5)
                .map(e -> new TopArtistDto(e.getKey(), topArtistNames.get(e.getKey()), e.getValue().intValue()))
                .toList();

        // Tür dağılımı (max 5)
        List<TopGenreDto> topGenres = attended.stream()
                .filter(e -> e.getGenre() != null && !e.getGenre().isBlank())
                .collect(Collectors.groupingBy(Event::getGenre, Collectors.counting()))
                .entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(5)
                .map(e -> new TopGenreDto(e.getKey(), e.getValue().intValue()))
                .toList();

        // Rozetler (kazanılmış + kilitli + ilerleme)
        List<BadgeResponse> badges = badgeService.getAllBadgesWithStatus(userId);

        return new PassportResponse(totalConcerts, verifiedConcerts,
                artistNames.size(), cityCount, byYear, events, bingoEventIds,
                badges, topArtists, topGenres);
    }
}