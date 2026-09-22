package com.concertly.backend.service;

import com.concertly.backend.dto.request.NotificationSettingsRequest;
import com.concertly.backend.dto.request.RegisterPushTokenRequest;
import com.concertly.backend.dto.response.NotificationSettingsResponse;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.PushToken;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.PushTokenRepository;
import com.concertly.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

@Service
public class PushTokenService {

    private final PushTokenRepository pushTokenRepository;
    private final UserRepository userRepository;

    public PushTokenService(PushTokenRepository pushTokenRepository, UserRepository userRepository) {
        this.pushTokenRepository = pushTokenRepository;
        this.userRepository = userRepository;
    }

    /**
     * Cihazı kaydeder ya da tazeler.
     *
     * Token benzersizdir: aynı cihazda başka bir hesaba giriş yapılırsa kayıt
     * yeni kullanıcıya TAŞINIR. Aksi halde önceki hesabın bildirimleri cihazı
     * devralan kişiye düşerdi.
     */
    @Transactional
    public void register(Long userId, RegisterPushTokenRequest request) {
        String token = request == null ? null : request.getToken();
        if (token == null || token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Push token gerekli.");
        }
        if (!token.startsWith("ExponentPushToken[") && !token.startsWith("ExpoPushToken[")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Geçersiz push token.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId));

        PushToken entity = pushTokenRepository.findByToken(token).orElseGet(PushToken::new);
        entity.setToken(token);
        entity.setUser(user);
        entity.setPlatform(request.getPlatform());
        String language = request.getLanguage();
        if (language != null && language.length() >= 2) {
            entity.setLanguage(language.substring(0, 2).toLowerCase());
        }
        entity.setLastSeenAt(LocalDateTime.now());
        pushTokenRepository.save(entity);
    }

    /** Çıkışta çağrılır: cihaz artık bu hesabın bildirimlerini almasın. */
    @Transactional
    public void unregister(Long userId, String token) {
        if (token == null || token.isBlank()) return;
        pushTokenRepository.deleteByUserIdAndToken(userId, token);
    }

    public NotificationSettingsResponse getSettings(Long userId) {
        return NotificationSettingsResponse.from(userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId)));
    }

    @Transactional
    public NotificationSettingsResponse updateSettings(Long userId, NotificationSettingsRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId));
        if (request != null) {
            if (request.getPushEnabled() != null)     user.setPushEnabled(request.getPushEnabled());
            if (request.getPushSocial() != null)      user.setPushSocial(request.getPushSocial());
            if (request.getPushMessages() != null)    user.setPushMessages(request.getPushMessages());
            if (request.getPushEvents() != null)      user.setPushEvents(request.getPushEvents());
            if (request.getPushCommunities() != null) user.setPushCommunities(request.getPushCommunities());
            if (request.getPushGames() != null)       user.setPushGames(request.getPushGames());
            userRepository.save(user);
        }
        return NotificationSettingsResponse.from(user);
    }
}
