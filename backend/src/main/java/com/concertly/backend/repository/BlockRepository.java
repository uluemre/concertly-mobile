package com.concertly.backend.repository;

import com.concertly.backend.model.Block;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface BlockRepository extends JpaRepository<Block, Long> {

    Optional<Block> findByBlockerIdAndBlockedId(Long blockerId, Long blockedId);

    boolean existsByBlockerIdAndBlockedId(Long blockerId, Long blockedId);

    /** Kullanıcının engellediği kişiler (en yeni önce). */
    List<Block> findByBlockerIdOrderByCreatedAtDesc(Long blockerId);

    /** Kullanıcının engellediği kişilerin id'leri. */
    @Query("select b.blocked.id from Block b where b.blocker.id = :userId")
    List<Long> findBlockedIds(@Param("userId") Long userId);

    /** Kullanıcıyı engelleyen kişilerin id'leri. */
    @Query("select b.blocker.id from Block b where b.blocked.id = :userId")
    List<Long> findBlockerIds(@Param("userId") Long userId);
}
