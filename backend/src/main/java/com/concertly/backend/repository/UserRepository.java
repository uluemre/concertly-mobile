package com.concertly.backend.repository;

import com.concertly.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    List<User> findAllByEmailIgnoreCase(String email);

    /**
     * Kullanıcının yazdığı e-postayla hesabı bulur (N-22): baş/son boşluk yok sayılır,
     * büyük/küçük harf fark etmez. Önce birebir eşleşme denenir (JWT'deki kayıtlı adres
     * gibi); eski kayıtlarda yalnızca harf büyüklüğü farklı iki hesap varsa hangisinin
     * kastedildiği belli olmadığından hiçbiri döndürülmez.
     */
    default Optional<User> findByEmailNormalized(String raw) {
        if (raw == null || raw.isBlank()) return Optional.empty();
        String email = raw.trim();
        Optional<User> exact = findByEmail(email);
        if (exact.isPresent()) return exact;
        List<User> matches = findAllByEmailIgnoreCase(email);
        return matches.size() == 1 ? Optional.of(matches.get(0)) : Optional.empty();
    }

    Optional<User> findByUsername(String username);

    // 🔥 SEARCH — yalnızca herkese açık kullanıcı adı; e-posta ile kullanıcı bulunamaz (gizlilik)
    default List<User> search(String q) {
        return searchByPattern(SearchText.containsPattern(q));
    }

    @Query("SELECT u FROM User u"
            + " WHERE " + SearchText.FOLD_OPEN + "u.username" + SearchText.FOLD_CLOSE + " LIKE :pattern ESCAPE '!'"
            + " ORDER BY u.username ASC")
    List<User> searchByPattern(@Param("pattern") String pattern);
}