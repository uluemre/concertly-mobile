package com.concertly.backend.repository;

import com.concertly.backend.model.Follow;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * SEC-05: follows.status NULL = ACCEPTED (eski satırlar); özel hesaba istek PENDING.
 * Sayımlar, listeler ve "takip ediyor mu" kontrolleri yalnızca kabul edilmiş satırları görür.
 */
public interface FollowRepository extends JpaRepository<Follow, Long> {

    /** Durumundan bağımsız (PENDING veya ACCEPTED) satır — idempotent takip/iptal için. */
    Optional<Follow> findByFollowerIdAndFollowingId(Long followerId, Long followingId);

    @Query("SELECT COUNT(f) > 0 FROM Follow f WHERE f.follower.id = :followerId AND f.following.id = :followingId "
            + "AND (f.status IS NULL OR f.status = 'ACCEPTED')")
    boolean isAcceptedFollower(@Param("followerId") Long followerId, @Param("followingId") Long followingId);

    @Query("SELECT COUNT(f) FROM Follow f WHERE f.following.id = :userId "
            + "AND (f.status IS NULL OR f.status = 'ACCEPTED')")
    long countAcceptedFollowers(@Param("userId") Long userId);

    @Query("SELECT COUNT(f) FROM Follow f WHERE f.follower.id = :userId "
            + "AND (f.status IS NULL OR f.status = 'ACCEPTED')")
    long countAcceptedFollowing(@Param("userId") Long userId);

    @Query("SELECT f FROM Follow f JOIN FETCH f.follower WHERE f.following.id = :userId "
            + "AND (f.status IS NULL OR f.status = 'ACCEPTED')")
    List<Follow> findAcceptedFollowers(@Param("userId") Long userId);

    @Query("SELECT f FROM Follow f JOIN FETCH f.following WHERE f.follower.id = :userId "
            + "AND (f.status IS NULL OR f.status = 'ACCEPTED')")
    List<Follow> findAcceptedFollowing(@Param("userId") Long userId);

    /** Hesap sahibine gelen bekleyen istekler — en yeni önce. */
    @Query("SELECT f FROM Follow f JOIN FETCH f.follower WHERE f.following.id = :userId "
            + "AND f.status = 'PENDING' ORDER BY f.id DESC")
    List<Follow> findPendingRequests(@Param("userId") Long userId, Pageable pageable);

    /** Bu kullanıcının, verilen kullanıcılar arasından KABUL EDİLMİŞ olarak takip ettikleri (toplu gizlilik süzgeci). */
    @Query("SELECT f.following.id FROM Follow f WHERE f.follower.id = :viewerId AND f.following.id IN :ids "
            + "AND (f.status IS NULL OR f.status = 'ACCEPTED')")
    List<Long> findAcceptedFollowingIds(@Param("viewerId") Long viewerId, @Param("ids") Collection<Long> ids);

    /** Özel → açık geçişte bekleyen tüm istekleri kabul eder. */
    @Modifying
    @Query("UPDATE Follow f SET f.status = 'ACCEPTED' WHERE f.following.id = :userId AND f.status = 'PENDING'")
    int acceptAllPending(@Param("userId") Long userId);
}
