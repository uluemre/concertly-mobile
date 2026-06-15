package com.concertly.backend.repository;

import com.concertly.backend.model.CommunityMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface CommunityMemberRepository extends JpaRepository<CommunityMember, Long> {

    Optional<CommunityMember> findByUserIdAndCommunityId(Long userId, Long communityId);

    long countByCommunityId(Long communityId);

    boolean existsByUserIdAndCommunityId(Long userId, Long communityId);

    // Toplu üye sayımı — (communityId, count)
    @Query("SELECT m.community.id, COUNT(m) FROM CommunityMember m WHERE m.community.id IN :ids GROUP BY m.community.id")
    List<Object[]> countByCommunityIdIn(@Param("ids") Collection<Long> ids);

    // Kullanıcının üye olduğu topluluk id'leri — "joined" bilgisini tek sorguda verir
    @Query("SELECT m.community.id FROM CommunityMember m WHERE m.user.id = :userId")
    Set<Long> findCommunityIdsByUserId(@Param("userId") Long userId);
}
