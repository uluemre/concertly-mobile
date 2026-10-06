package com.concertly.backend.service;

import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.DailySongPlay;
import com.concertly.backend.repository.DailySongPlayRepository;
import com.concertly.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class DailySongService {

    public static final int MAX_ATTEMPTS = 5;
    /** Deneme başına dinleme süresi (ms): 1sn → 2sn → 4sn → 8sn → 15sn */
    public static final int[] SNIPPET_MS = {1000, 2000, 4000, 8000, 15000};
    /** Gün numarası "#1" bu tarihten başlar */
    private static final long LAUNCH_EPOCH_DAY = LocalDate.of(2026, 6, 1).toEpochDay();

    private final DeezerService deezerService;
    private final DailySongPlayRepository playRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    private final long playlistId;

    // Gün bazlı havuz önbelleği — gün değişince tazelenir, gün içinde sabit kalır
    private volatile List<DeezerService.Track> cachedPool = List.of();
    private volatile long cachedPoolDay = -1;
    /** Önizleme linki ~15 dk geçerli: 10 dk'dan eski link yenilenir. */
    static final long PREVIEW_TTL_MS = 10 * 60 * 1000L;
    private volatile String cachedPreview;
    private volatile Long cachedPreviewTrackId;
    private volatile long cachedPreviewAt;

    public DailySongService(DeezerService deezerService,
                            DailySongPlayRepository playRepository,
                            UserRepository userRepository,
                            NotificationService notificationService,
                            @Value("${daily.song.playlist.id:7678032782}") long playlistId) {
        this.deezerService = deezerService;
        this.playRepository = playRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.playlistId = playlistId;
    }

    /** Her sabah 10:00 — tüm aktif kullanıcılara günün şarkısı duyurusu (kullanıcı/gün başına tek sefer). */
    @org.springframework.scheduling.annotation.Scheduled(cron = "${daily.song.notify.cron:0 0 10 * * *}")
    public void announceDailySong() {
        long today = LocalDate.now().toEpochDay();
        long dayNumber = today - LAUNCH_EPOCH_DAY + 1;
        userRepository.findAll().forEach(u ->
                notificationService.sendSystem(u.getId(), "daily_song", "daily_song", today,
                        "Gün #" + dayNumber));
        System.out.println("🎵 Günün şarkısı duyurusu gönderildi (gün #" + dayNumber + ")");
    }

    // ── Günün şarkısı ───────────────────────────────────────────────────────

    public Map<String, Object> getToday(Long userId) {
        long today = LocalDate.now().toEpochDay();
        DeezerService.Track track = trackOfDay(today);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("dayNumber", today - LAUNCH_EPOCH_DAY + 1);
        result.put("previewUrl", freshPreview(track));
        result.put("maxAttempts", MAX_ATTEMPTS);
        result.put("snippetMs", SNIPPET_MS);

        DailySongPlay play = playRepository.findByUserIdAndEpochDay(userId, today).orElse(null);
        boolean finished = play != null && (play.isSolved() || play.getAttemptsUsed() >= MAX_ATTEMPTS);

        result.put("attemptsUsed", play != null ? play.getAttemptsUsed() : 0);
        result.put("solved", play != null && play.isSolved());
        result.put("finished", finished);
        if (finished) {
            result.put("answer", answerMap(track));
            result.put("solvedAttempt", play.getSolvedAttempt());
        }
        List<DailySongPlay> solvedPlays = playRepository.findByUserIdAndSolvedTrueOrderByEpochDayDesc(userId);
        result.put("streak", streakOf(solvedPlays, today));
        result.put("week", weekOf(solvedPlays, LocalDate.ofEpochDay(today)));
        result.put("stats", dayStats(today));
        return result;
    }

    @Transactional
    public Map<String, Object> guess(Long userId, String guessTitle, boolean skip) {
        long today = LocalDate.now().toEpochDay();
        DeezerService.Track track = trackOfDay(today);

        DailySongPlay play = playRepository.findByUserIdAndEpochDay(userId, today)
                .orElseGet(() -> {
                    DailySongPlay p = new DailySongPlay();
                    p.setUser(userRepository.findById(userId)
                            .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId)));
                    p.setEpochDay(today);
                    return p;
                });

        boolean alreadyFinished = play.isSolved() || play.getAttemptsUsed() >= MAX_ATTEMPTS;
        if (!alreadyFinished) {
            play.setAttemptsUsed(play.getAttemptsUsed() + 1);
            if (!skip && titlesMatch(guessTitle, track.title)) {
                play.setSolved(true);
                play.setSolvedAttempt(play.getAttemptsUsed());
            }
            playRepository.save(play);
        }

        boolean finished = play.isSolved() || play.getAttemptsUsed() >= MAX_ATTEMPTS;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("correct", play.isSolved());
        result.put("attemptsUsed", play.getAttemptsUsed());
        result.put("finished", finished);
        if (finished) {
            result.put("answer", answerMap(track));
            result.put("solvedAttempt", play.getSolvedAttempt());
            result.put("streak", computeStreak(userId, today));
            result.put("stats", dayStats(today));
        }
        return result;
    }

    // ── Yardımcılar ─────────────────────────────────────────────────────────

    private DeezerService.Track trackOfDay(long epochDay) {
        List<DeezerService.Track> pool = getPool(epochDay);
        if (pool.isEmpty()) {
            throw new IllegalStateException("Günlük şarkı havuzu yüklenemedi");
        }
        return pool.get((int) (epochDay % pool.size()));
    }

    /**
     * Havuz gün boyu sabit kalır (şarkı gün içinde değişmesin), ama içindeki önizleme linkleri
     * ~15 dk sonra 403 verir. Günün şarkısının linki şarkı kimliğinden taze alınır.
     */
    String freshPreview(DeezerService.Track track) {
        if (track.deezerId == null) return track.previewUrl;
        long now = System.currentTimeMillis();
        if (track.deezerId.equals(cachedPreviewTrackId) && cachedPreview != null && now - cachedPreviewAt < PREVIEW_TTL_MS) {
            return cachedPreview;
        }
        String fresh = deezerService.getTrackPreview(track.deezerId);
        if (fresh == null) return track.previewUrl;
        cachedPreview = fresh;
        cachedPreviewTrackId = track.deezerId;
        cachedPreviewAt = now;
        return fresh;
    }

    private List<DeezerService.Track> getPool(long epochDay) {
        if (cachedPoolDay != epochDay || cachedPool.isEmpty()) {
            synchronized (this) {
                if (cachedPoolDay != epochDay || cachedPool.isEmpty()) {
                    List<DeezerService.Track> fresh = deezerService.getPlaylistTracks(playlistId, 300);
                    if (!fresh.isEmpty()) {
                        cachedPool = fresh;
                        cachedPoolDay = epochDay;
                    }
                }
            }
        }
        return cachedPool;
    }

    private Map<String, Object> answerMap(DeezerService.Track track) {
        return Map.of(
                "title", track.title,
                "artist", track.artistName,
                "coverUrl", track.coverUrl
        );
    }

    /** Başlık karşılaştırması — Türkçe karakterlere ve noktalama farklarına toleranslı. */
    static boolean titlesMatch(String guess, String answer) {
        if (guess == null || answer == null) return false;
        String g = normalizeTitle(guess);
        String a = normalizeTitle(answer);
        if (g.isEmpty() || a.isEmpty()) return false;
        return g.equals(a);
    }

    static String normalizeTitle(String s) {
        String lowered = s.toLowerCase(Locale.forLanguageTag("tr"))
                .replaceAll("\\(.*?\\)|\\[.*?\\]", " ")   // parantez içlerini at
                .replace('ı', 'i').replace('ş', 's').replace('ç', 'c')
                .replace('ğ', 'g').replace('ü', 'u').replace('ö', 'o');
        // aksanları sadeleştir, harf/rakam dışını at
        String ascii = Normalizer.normalize(lowered, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return ascii.replaceAll("[^a-z0-9]+", " ").trim();
    }

    /**
     * İçinde bulunulan haftanın (Pazartesi → Pazar) çözüm durumu, Oyunlar ekranındaki
     * gün noktaları için: 7 eleman, çözülen gün true.
     */
    static List<Boolean> weekOf(List<DailySongPlay> solvedPlays, LocalDate today) {
        long monday = today.with(java.time.DayOfWeek.MONDAY).toEpochDay();
        Boolean[] week = {false, false, false, false, false, false, false};
        for (DailySongPlay p : solvedPlays) {
            long i = p.getEpochDay() - monday;
            if (i >= 0 && i < 7) week[(int) i] = true;
        }
        return List.of(week);
    }

    private int computeStreak(Long userId, long today) {
        return streakOf(playRepository.findByUserIdAndSolvedTrueOrderByEpochDayDesc(userId), today);
    }

    static int streakOf(List<DailySongPlay> solvedPlays, long today) {
        if (solvedPlays.isEmpty()) return 0;

        // Seri bugünden ya da (bugün henüz çözülmediyse) dünden geriye sayılır
        long cursor = solvedPlays.get(0).getEpochDay() == today ? today : today - 1;
        int streak = 0;
        for (DailySongPlay p : solvedPlays) {
            if (p.getEpochDay() == cursor) {
                streak++;
                cursor--;
            } else if (p.getEpochDay() < cursor) {
                break;
            }
        }
        return streak;
    }

    private Map<String, Object> dayStats(long epochDay) {
        long players = playRepository.countByEpochDay(epochDay);
        long solved = playRepository.countByEpochDayAndSolvedTrue(epochDay);
        return Map.of(
                "players", players,
                "solvedPercent", players > 0 ? Math.round(solved * 100.0 / players) : 0
        );
    }
}
