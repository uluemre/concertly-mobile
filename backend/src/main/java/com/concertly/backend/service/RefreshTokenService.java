package com.concertly.backend.service;

import com.concertly.backend.model.RefreshToken;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.RefreshTokenRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

@Service
public class RefreshTokenService {

    private final RefreshTokenRepository repository;

    @Value("${jwt.refresh.expiration.days:30}")
    private int refreshExpirationDays;

    public RefreshTokenService(RefreshTokenRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public RefreshToken create(User user) {
        repository.deleteByUser(user);

        RefreshToken token = new RefreshToken();
        token.setUser(user);
        token.setToken(UUID.randomUUID().toString());
        token.setExpiresAt(Instant.now().plus(refreshExpirationDays, ChronoUnit.DAYS));
        return repository.save(token);
    }

    public Optional<RefreshToken> findByToken(String token) {
        return repository.findByToken(token);
    }

    public boolean isExpired(RefreshToken token) {
        return token.getExpiresAt().isBefore(Instant.now());
    }

    @Transactional
    public void deleteByUser(User user) {
        repository.deleteByUser(user);
    }

    @Transactional
    public void delete(RefreshToken token) {
        repository.delete(token);
    }
}
