package com.concertly.backend.service;

import com.concertly.backend.dto.response.BadgeResponse;
import com.concertly.backend.model.*;
import com.concertly.backend.repository.*;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class BadgeService {

    private final BadgeRepository badgeRepository;
    private final UserBadgeRepository userBadgeRepository;
    private final UserRepository userRepository;
    private final ConcertAttendanceService concertAttendance;
    private final PostRepository postRepository;
    private final NotificationService notificationService;

    /** Kazanıldığında bildirim gitmeyen rozetler: "Yeni Üye" herkese kayıtta verilir. */
    static final Set<String> SILENT_BADGES = Set.of("yeni_uye");

    public BadgeService(BadgeRepository badgeRepository,
                        UserBadgeRepository userBadgeRepository,
                        UserRepository userRepository,
                        ConcertAttendanceService concertAttendance,
                        PostRepository postRepository,
                        NotificationService notificationService) {
        this.badgeRepository = badgeRepository;
        this.userBadgeRepository = userBadgeRepository;
        this.userRepository = userRepository;
        this.concertAttendance = concertAttendance;
        this.postRepository = postRepository;
        this.notificationService = notificationService;
    }

    @PostConstruct
    public void seedBadges() {
        ensureBadge("ilk_konser",      "İlk Konser",          "İlk etkinliğine katıldın!",              "🎵");
        ensureBadge("konser_kurdu",    "Konser Kurdu",        "5 etkinliğe katıldın.",                   "🎸");
        ensureBadge("festival_sezonu", "Festival Sezonu",     "10 etkinliğe katıldın.",                  "🎪");
        ensureBadge("efsane_seyirci",  "Efsane Seyirci",      "25 etkinliğe katıldın.",                  "👑");
        ensureBadge("ilk_paylasim",    "Hikaye Anlatıcısı",   "İlk paylaşımını yaptın!",                 "📝");
        ensureBadge("sosyal_kelebek",  "Sosyal Kelebek",      "5 paylaşım yaptın.",                      "🦋");
        ensureBadge("icerik_ustasi",   "İçerik Ustası",       "20 paylaşım yaptın.",                     "🌟");
        ensureBadge("yeni_uye",        "Yeni Üye",            "Uygulamaya hoş geldin!",                  "🎉");
    }

    private void ensureBadge(String code, String name, String description, String icon) {
        if (badgeRepository.findByCode(code).isEmpty()) {
            Badge b = new Badge();
            b.setCode(code);
            b.setName(name);
            b.setDescription(description);
            b.setIcon(icon);
            badgeRepository.save(b);
        }
    }

    public List<BadgeResponse> getUserBadges(Long userId) {
        return userBadgeRepository.findByUserId(userId)
                .stream()
                .map(ub -> BadgeResponse.from(ub.getBadge(), ub.getEarnedAt()))
                .collect(Collectors.toList());
    }

    public List<BadgeResponse> getAllBadges() {
        return badgeRepository.findAll()
                .stream()
                .map(b -> BadgeResponse.from(b, null))
                .collect(Collectors.toList());
    }

    public List<BadgeResponse> getAllBadgesWithStatus(Long userId) {
        checkAndAwardBadges(userId);
        // Yalnızca katıldığı (tarihi geçmiş "Gidiyorum") konserler; gelecektekiler sayılmaz
        int attendance = (int) concertAttendance.attendedCount(userId);
        int postCount  = (int) postRepository.countByUserId(userId);

        java.util.Map<String, java.time.LocalDateTime> earnedMap = new java.util.HashMap<>();
        userBadgeRepository.findByUserId(userId)
                .forEach(ub -> earnedMap.put(ub.getBadge().getCode(), ub.getEarnedAt()));

        return badgeRepository.findAll().stream().map(badge -> {
            java.time.LocalDateTime earnedAt = earnedMap.get(badge.getCode());
            int progress = 0;
            int required = 0;
            switch (badge.getCode()) {
                case "yeni_uye"        -> { progress = 1;          required = 1; }
                case "ilk_konser"      -> { progress = attendance; required = 1; }
                case "konser_kurdu"    -> { progress = attendance; required = 5; }
                case "festival_sezonu" -> { progress = attendance; required = 10; }
                case "efsane_seyirci"  -> { progress = attendance; required = 25; }
                case "ilk_paylasim"    -> { progress = postCount;  required = 1; }
                case "sosyal_kelebek"  -> { progress = postCount;  required = 5; }
                case "icerik_ustasi"   -> { progress = postCount;  required = 20; }
            }
            return BadgeResponse.withProgress(badge, earnedAt, Math.min(progress, required), required);
        }).collect(Collectors.toList());
    }

    public void checkAndAwardBadges(Long userId) {
        // Yeni üye rozeti — her zaman kontrol et
        awardIfNotExists(userId, "yeni_uye");

        // Etkinlik rozeti
        // Yalnızca katıldığı konserler. Daha önce verilmiş rozetler geri ALINMAZ:
        // bu metot yalnızca eksik rozeti ekler (awardIfNotExists), hiçbirini silmez.
        long attendanceCount = concertAttendance.attendedCount(userId);
        if (attendanceCount >= 1)  awardIfNotExists(userId, "ilk_konser");
        if (attendanceCount >= 5)  awardIfNotExists(userId, "konser_kurdu");
        if (attendanceCount >= 10) awardIfNotExists(userId, "festival_sezonu");
        if (attendanceCount >= 25) awardIfNotExists(userId, "efsane_seyirci");

        // Paylaşım rozeti
        long postCount = postRepository.countByUserId(userId);
        if (postCount >= 1)  awardIfNotExists(userId, "ilk_paylasim");
        if (postCount >= 5)  awardIfNotExists(userId, "sosyal_kelebek");
        if (postCount >= 20) awardIfNotExists(userId, "icerik_ustasi");
    }

    private void awardIfNotExists(Long userId, String badgeCode) {
        if (userBadgeRepository.existsByUserIdAndBadgeCode(userId, badgeCode)) return;
        badgeRepository.findByCode(badgeCode).ifPresent(badge -> {
            if (userRepository.findById(userId).isEmpty()) return;
            // Eşzamanlı kontrolde ikinci ekleme sessizce 0 döner; eskiden kısıt
            // hatası gönderi/katılım isteğini bozabiliyordu (N-38)
            int inserted = userBadgeRepository.insertIfAbsent(userId, badge.getId(), LocalDateTime.now());
            if (inserted == 0) return;
            // Yalnızca GERÇEKTEN yeni kazanılan rozet bildirilir; eski rozetler için
            // geriye dönük bildirim yok. sendSystem aynı (kullanıcı, rozet) için
            // ikinci bildirimi zaten açmaz. Mesaj alanı rozet kodunu taşır: metin
            // push'ta sunucuda, uygulamada istemcide dile göre üretilir.
            if (!SILENT_BADGES.contains(badgeCode)) {
                notificationService.sendSystem(userId, "badge", "badge", badge.getId(), badgeCode);
            }
        });
    }
}
