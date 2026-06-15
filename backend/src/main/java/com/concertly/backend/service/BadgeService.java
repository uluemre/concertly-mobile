package com.concertly.backend.service;

import com.concertly.backend.dto.response.BadgeResponse;
import com.concertly.backend.model.*;
import com.concertly.backend.repository.*;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class BadgeService {

    private final BadgeRepository badgeRepository;
    private final UserBadgeRepository userBadgeRepository;
    private final UserRepository userRepository;
    private final EventAttendanceRepository attendanceRepository;
    private final PostRepository postRepository;

    public BadgeService(BadgeRepository badgeRepository,
                        UserBadgeRepository userBadgeRepository,
                        UserRepository userRepository,
                        EventAttendanceRepository attendanceRepository,
                        PostRepository postRepository) {
        this.badgeRepository = badgeRepository;
        this.userBadgeRepository = userBadgeRepository;
        this.userRepository = userRepository;
        this.attendanceRepository = attendanceRepository;
        this.postRepository = postRepository;
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
        int attendance = (int) attendanceRepository.countByUserIdAndStatus(userId, AttendanceStatus.GOING);
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
        long attendanceCount = attendanceRepository.countByUserIdAndStatus(userId, AttendanceStatus.GOING);
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
            User user = userRepository.findById(userId).orElse(null);
            if (user == null) return;
            UserBadge ub = new UserBadge();
            ub.setUser(user);
            ub.setBadge(badge);
            userBadgeRepository.save(ub);
        });
    }
}
