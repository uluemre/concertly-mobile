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

    // Yeni rozet serileri için veri (alan enjeksiyonu: kurucuyu kullanan testler değişmesin;
    // yoksa ilgili rozetler atlanır).
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.concertly.backend.repository.ArtistFollowRepository artistFollowRepository;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.concertly.backend.repository.DailySongPlayRepository dailySongPlayRepository;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.concertly.backend.repository.CommunityMemberRepository communityMemberRepository;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.concertly.backend.repository.CommunityRepository communityRepository;

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
        // Şehirler: farklı şehirlerde konser
        ensureBadge("yola_cikan",      "Yola Çıkan",          "2 farklı şehirde konsere gittin.",        "🧭");
        ensureBadge("sehir_gezgini",   "Şehir Gezgini",       "5 farklı şehirde konsere gittin.",        "🗺️");
        ensureBadge("turkiye_turu",    "Türkiye Turu",        "10 farklı şehirde konsere gittin.",       "🚌");
        // Sadakat: aynı sanatçıyı tekrar tekrar
        ensureBadge("sadik_hayran",    "Sadık Hayran",        "Aynı sanatçıyı 3 kez canlı izledin.",     "💞");
        ensureBadge("gercek_fan",      "Gerçek Fan",          "Aynı sanatçıyı 5 kez canlı izledin.",     "🔥");
        // Keşif: sanatçı takibi
        ensureBadge("muzik_kasifi",    "Müzik Kâşifi",        "5 sanatçı takip ediyorsun.",             "🔭");
        ensureBadge("kesif_tutkunu",   "Keşif Tutkunu",       "10 sanatçı takip ediyorsun.",            "🧭");
        ensureBadge("koleksiyoncu",    "Koleksiyoncu",        "20 sanatçı takip ediyorsun.",            "💿");
        // Günlük şarkı
        ensureBadge("kulak_misafiri",  "Kulak Misafiri",      "İlk günlük şarkıyı bildin.",             "👂");
        ensureBadge("kulagi_delik",    "Kulağı Delik",        "7 günlük şarkıyı bildin.",               "🎧");
        ensureBadge("muzik_dahisi",    "Müzik Dahisi",        "30 günlük şarkıyı bildin.",              "🧠");
        // Topluluk
        ensureBadge("topluluk_ruhu",   "Topluluk Ruhu",       "Bir topluluğa katıldın.",                "🤝");
        ensureBadge("kurucu",          "Kurucu",              "Kendi topluluğunu kurdun.",              "🏗️");
    }

    private void ensureBadge(String code, String name, String description, String icon) {
        java.util.Optional<Badge> existing = badgeRepository.findByCode(code);
        if (existing.isEmpty()) {
            Badge b = new Badge();
            b.setCode(code);
            b.setName(name);
            b.setDescription(description);
            b.setIcon(icon);
            badgeRepository.save(b);
        } else if (!name.equals(existing.get().getName()) || !description.equals(existing.get().getDescription())) {
            // Eşik / metin değiştiyse (ör. Şehir Gezgini 3 → 5 şehir) kayıt da güncellenir
            Badge b = existing.get();
            b.setName(name);
            b.setDescription(description);
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
        Stats st = stats(userId);

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
                case "yola_cikan"      -> { progress = st.cities();       required = 2; }
                case "sehir_gezgini"   -> { progress = st.cities();       required = 5; }
                case "turkiye_turu"    -> { progress = st.cities();       required = 10; }
                case "sadik_hayran"    -> { progress = st.sameArtist();   required = 3; }
                case "gercek_fan"      -> { progress = st.sameArtist();   required = 5; }
                case "muzik_kasifi"    -> { progress = st.followedArtists(); required = 5; }
                case "kesif_tutkunu"   -> { progress = st.followedArtists(); required = 10; }
                case "koleksiyoncu"    -> { progress = st.followedArtists(); required = 20; }
                case "kulak_misafiri"  -> { progress = st.dailySolved();  required = 1; }
                case "kulagi_delik"    -> { progress = st.dailySolved();  required = 7; }
                case "muzik_dahisi"    -> { progress = st.dailySolved();  required = 30; }
                case "topluluk_ruhu"   -> { progress = st.communities();  required = 1; }
                case "kurucu"          -> { progress = st.ownedCommunities(); required = 1; }
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

        Stats st = stats(userId);
        if (st.cities() >= 2) awardIfNotExists(userId, "yola_cikan");
        if (st.cities() >= 5) awardIfNotExists(userId, "sehir_gezgini");
        if (st.cities() >= 10) awardIfNotExists(userId, "turkiye_turu");
        if (st.sameArtist() >= 3) awardIfNotExists(userId, "sadik_hayran");
        if (st.sameArtist() >= 5) awardIfNotExists(userId, "gercek_fan");
        if (st.followedArtists() >= 5) awardIfNotExists(userId, "muzik_kasifi");
        if (st.followedArtists() >= 10) awardIfNotExists(userId, "kesif_tutkunu");
        if (st.followedArtists() >= 20) awardIfNotExists(userId, "koleksiyoncu");
        if (st.dailySolved() >= 1) awardIfNotExists(userId, "kulak_misafiri");
        if (st.dailySolved() >= 7) awardIfNotExists(userId, "kulagi_delik");
        if (st.dailySolved() >= 30) awardIfNotExists(userId, "muzik_dahisi");
        if (st.communities() >= 1) awardIfNotExists(userId, "topluluk_ruhu");
        if (st.ownedCommunities() >= 1) awardIfNotExists(userId, "kurucu");
    }

    /** Yeni serilerin ölçütleri. Veri kaynağı yoksa (testlerde) 0 sayılır. */
    record Stats(int cities, int sameArtist, int followedArtists, int dailySolved,
                 int communities, int ownedCommunities) {}

    Stats stats(Long userId) {
        // Katıldığı (tarihi geçmiş "Gidiyorum") konserler: farklı şehir ve aynı sanatçı sayısı
        java.util.Set<String> cities = new java.util.HashSet<>();
        java.util.Map<Long, Integer> perArtist = new java.util.HashMap<>();
        for (com.concertly.backend.model.Event e : concertAttendance.attended(userId)) {
            if (e.getVenue() != null && e.getVenue().getCity() != null && !e.getVenue().getCity().isBlank()) {
                cities.add(com.concertly.backend.config.LaunchCityConfig.normalize(e.getVenue().getCity()));
            }
            if (e.getArtist() != null && e.getArtist().getId() != null) {
                perArtist.merge(e.getArtist().getId(), 1, Integer::sum);
            }
        }
        int sameArtist = perArtist.values().stream().mapToInt(Integer::intValue).max().orElse(0);
        int follows = artistFollowRepository == null ? 0 : (int) artistFollowRepository.countByUserId(userId);
        int solved = dailySongPlayRepository == null ? 0 : (int) dailySongPlayRepository.countByUserIdAndSolvedTrue(userId);
        int joined = communityMemberRepository == null ? 0
                : (int) communityMemberRepository.countByUserIdAndStatus(userId, "ACTIVE");
        int owned = communityRepository == null ? 0 : (int) communityRepository.countByOwnerId(userId);
        return new Stats(cities.size(), sameArtist, follows, solved, joined, owned);
    }

    /**
     * İşlem bittikten sonra çağrılır (takip, günlük şarkı, topluluk). Rozet tarafındaki bir
     * hata asıl işlemi bozmasın diye yutulur.
     */
    public void checkQuietly(Long userId) {
        try {
            checkAndAwardBadges(userId);
        } catch (Exception ignored) {
            // rozet bir sonraki kontrolde (profil açılışı) yine verilir
        }
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
