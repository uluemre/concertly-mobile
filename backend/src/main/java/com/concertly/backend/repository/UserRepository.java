package com.concertly.backend.repository;

import com.concertly.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

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