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

    boolean existsByUserIdAndCommunityIdAndStatus(Long userId, Long communityId, String status);

    // Kullanıcının tüm üyelikleri (her durumda) — liste görünümünde rol/durum eşlemesi için
    List<CommunityMember> findByUserId(Long userId);

    // Bir topluluğun belirli durumdaki üyeleri (ACTIVE üyeler, PENDING istekler, INVITED davetler)
    List<CommunityMember> findByCommunityIdAndStatusOrderByJoinedAtDesc(Long communityId, String status);

    // Kullanıcının belirli durumdaki üyelikleri ("topluluklarım", "bekleyen isteklerim")
    List<CommunityMember> findByUserIdAndStatus(Long userId, String status);

    long countByCommunityIdAndStatus(Long communityId, String status);

    void deleteByCommunityId(Long communityId);

    // Toplu ACTIVE üye sayımı — (communityId, count)
    @Query("SELECT m.community.id, COUNT(m) FROM CommunityMember m " +
           "WHERE m.community.id IN :ids AND m.status = 'ACTIVE' GROUP BY m.community.id")
    List<Object[]> countActiveByCommunityIdIn(@Param("ids") Collection<Long> ids);

    // Kullanıcının ACTIVE üye olduğu topluluk id'leri — "joined" bilgisini tek sorguda verir
    @Query("SELECT m.community.id FROM CommunityMember m WHERE m.user.id = :userId AND m.status = 'ACTIVE'")
    Set<Long> findActiveCommunityIdsByUserId(@Param("userId") Long userId);
}
