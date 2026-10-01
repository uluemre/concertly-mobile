package com.concertly.backend.repository;

import com.concertly.backend.model.Community;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CommunityRepository extends JpaRepository<Community, Long> {

    List<Community> findByType(String type);

    @Query("""
                SELECT c FROM Community c
                WHERE LOWER(c.type) IN :types
                ORDER BY c.createdAt DESC
            """)
    List<Community> findByTypeIn(@Param("types") List<String> types);

    // Türkçe harf / büyük-küçük harf duyarsız, % ve _ joker değil (SearchText; NEW-02)
    default List<Community> search(String q) {
        return searchByPattern(SearchText.containsPattern(q));
    }

    @Query("SELECT c FROM Community c"
            + " WHERE " + SearchText.FOLD_OPEN + "c.name" + SearchText.FOLD_CLOSE + " LIKE :pattern ESCAPE '!'"
            + " OR " + SearchText.FOLD_OPEN + "c.city" + SearchText.FOLD_CLOSE + " LIKE :pattern ESCAPE '!'"
            + " OR " + SearchText.FOLD_OPEN + "c.tags" + SearchText.FOLD_CLOSE + " LIKE :pattern ESCAPE '!'"
            + " ORDER BY c.createdAt DESC")
    List<Community> searchByPattern(@Param("pattern") String pattern);

    Optional<Community> findByInviteCode(String inviteCode);

    long countByOwnerId(Long ownerId);

    // Hesap silinirken sahiplik devri için: kullanıcının sahip olduğu tüm topluluklar
    List<Community> findByOwnerId(Long ownerId);

    // Admin inceleme kuyruğu — en eski bekleyen en üstte (SLA takibi için)
    List<Community> findByApprovalStatusOrderByCreatedAtAsc(String approvalStatus);

    // Eski/seed kayıtları için backfill: kolon eklendiğinde null kalanları doldur
    List<Community> findByApprovalStatusIsNullOrVisibilityIsNull();
}
