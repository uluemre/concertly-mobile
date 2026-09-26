package com.concertly.backend.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertTrue;

/** N-14: trend sıralaması etkileşimi ve yaşı birlikte tartar. */
class PostTrendingScoreTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 9, 26, 12, 0);

    @Test
    void engagementBeatsRecencyWithinAFewDays() {
        double freshNoLikes = PostService.trendingScore(0, 0, NOW.minusHours(2), NOW);
        double dayOldLiked = PostService.trendingScore(5, 1, NOW.minusDays(1), NOW);
        assertTrue(dayOldLiked > freshNoLikes, "1 günlük 5 beğenili gönderi, 2 saatlik boş gönderinin önünde");
    }

    @Test
    void sameAgeMoreEngagementRanksHigherAndCommentsWeighMore() {
        LocalDateTime t = NOW.minusDays(2);
        assertTrue(PostService.trendingScore(8, 4, t, NOW) > PostService.trendingScore(2, 0, t, NOW));
        assertTrue(PostService.trendingScore(0, 2, t, NOW) > PostService.trendingScore(3, 0, t, NOW),
                "yorum beğeniden ağır");
    }

    @Test
    void oldPostsFadeEvenWithEngagement() {
        double monthsOldPopular = PostService.trendingScore(8, 4, NOW.minusDays(120), NOW);
        double recentModest = PostService.trendingScore(2, 1, NOW.minusDays(1), NOW);
        assertTrue(recentModest > monthsOldPopular, "4 aylık gönderi trendden çıkar");
        assertTrue(PostService.trendingScore(0, 0, null, NOW) > 0, "tarihsiz gönderi hata vermez");
    }
}
