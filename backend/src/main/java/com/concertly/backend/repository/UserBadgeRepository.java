package com.concertly.backend.repository;

import com.concertly.backend.model.UserBadge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

public interface UserBadgeRepository extends JpaRepository<UserBadge, Long> {
    List<UserBadge> findByUserId(Long userId);
    boolean existsByUserIdAndBadgeCode(Long userId, String badgeCode);

    /**
     * Rozeti yalnızca yoksa ekler; eklenen satır sayısını döner (1 = yeni kazanıldı).
     * Aynı anda gelen iki kontrol (ör. profil + pasaport) aynı rozeti eklemeye
     * çalışırsa ikincisi hata vermeden 0 döner (N-38). Çakışma hedefi bilerek
     * yazılmadı: hangi benzersizlik kısıtı varsa ona takılır.
     */
    @Modifying
    @Transactional
    @Query(value = "INSERT INTO user_badges (user_id, badge_id, earned_at) "
            + "VALUES (:userId, :badgeId, :earnedAt) ON CONFLICT DO NOTHING", nativeQuery = true)
    int insertIfAbsent(@Param("userId") Long userId,
                       @Param("badgeId") Long badgeId,
                       @Param("earnedAt") LocalDateTime earnedAt);
}
