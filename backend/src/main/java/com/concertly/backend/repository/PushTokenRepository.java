package com.concertly.backend.repository;

import com.concertly.backend.model.PushToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface PushTokenRepository extends JpaRepository<PushToken, Long> {

    Optional<PushToken> findByToken(String token);

    List<PushToken> findByUserId(Long userId);

    // Ölü token temizliği push gönderim iş parçacığından çağrılır; orada
    // çevreleyen bir transaction yok, bu yüzden metotlar kendi transaction'ını açar.
    @Transactional
    @Modifying
    void deleteByToken(String token);

    @Transactional
    @Modifying
    void deleteByUserIdAndToken(Long userId, String token);
}
