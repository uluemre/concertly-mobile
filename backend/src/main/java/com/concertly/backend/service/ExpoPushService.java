package com.concertly.backend.service;

import com.concertly.backend.config.ExternalHttp;
import com.concertly.backend.model.PushToken;
import com.concertly.backend.repository.PushTokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import jakarta.annotation.PreDestroy;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * Expo Push API istemcisi (https://exp.host/--/api/v2/push/send).
 *
 * Gönderim istek iş parçacığını BLOKLAMAZ: beğeni/yorum gibi akış üzerindeki
 * işlemler push servisinin yavaşlığına takılmamalı. Bu yüzden kendi küçük
 * havuzunda çalışır ve her hata yutulur — bildirim zaten veritabanına yazılmış
 * durumdadır, push yalnızca ek kanaldır.
 *
 * Expo "DeviceNotRegistered" derse token ölmüştür (uygulama silinmiş / izin
 * kapatılmış): kaydı sileriz, yoksa her seferinde boşa istek atarız.
 */
@Service
public class ExpoPushService {

    private static final Logger log = LoggerFactory.getLogger(ExpoPushService.class);

    /** Expo tek istekte en fazla 100 mesaj kabul eder. */
    private static final int CHUNK_SIZE = 100;

    private final PushTokenRepository pushTokenRepository;
    private final RestTemplate restTemplate = ExternalHttp.restTemplate();
    private final ExecutorService executor = Executors.newFixedThreadPool(2, r -> {
        Thread t = new Thread(r, "expo-push");
        t.setDaemon(true);
        return t;
    });

    private final boolean enabled;
    private final String endpoint;
    private final String accessToken;

    public ExpoPushService(PushTokenRepository pushTokenRepository,
            @Value("${app.push.enabled:true}") boolean enabled,
            @Value("${app.push.expo-endpoint:https://exp.host/--/api/v2/push/send}") String endpoint,
            @Value("${app.push.expo-access-token:}") String accessToken) {
        this.pushTokenRepository = pushTokenRepository;
        this.enabled = enabled;
        this.endpoint = endpoint;
        this.accessToken = accessToken;
    }

    /** Gönderilecek tek bir bildirim (token + hazır metin). */
    public record Message(String token, String title, String body, Map<String, Object> data, Long badge) {}

    /** Mesajları arka planda gönderir; çağıran beklemez. */
    public void sendAsync(List<Message> messages) {
        if (!enabled || messages == null || messages.isEmpty()) return;
        executor.submit(() -> {
            try {
                send(messages);
            } catch (Exception e) {
                log.warn("Push gönderimi başarısız: {}", e.getMessage());
            }
        });
    }

    /** Senkron gönderim — testler ve zamanlanmış toplu işler için. */
    @SuppressWarnings("unchecked")
    public void send(List<Message> messages) {
        if (!enabled || messages == null || messages.isEmpty()) return;

        for (int start = 0; start < messages.size(); start += CHUNK_SIZE) {
            List<Message> chunk = messages.subList(start, Math.min(start + CHUNK_SIZE, messages.size()));
            List<Map<String, Object>> payload = new ArrayList<>(chunk.size());
            for (Message m : chunk) {
                Map<String, Object> item = new HashMap<>();
                item.put("to", m.token());
                item.put("title", m.title());
                item.put("body", m.body());
                item.put("sound", "default");
                item.put("channelId", "default");
                item.put("priority", "high");
                if (m.badge() != null) item.put("badge", m.badge());
                if (m.data() != null) item.put("data", m.data());
                payload.add(item);
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(List.of(MediaType.APPLICATION_JSON));
            if (accessToken != null && !accessToken.isBlank()) {
                headers.setBearerAuth(accessToken);
            }

            Map<String, Object> response;
            try {
                response = restTemplate.postForObject(endpoint, new HttpEntity<>(payload, headers), Map.class);
            } catch (Exception e) {
                log.warn("Expo push isteği başarısız ({} mesaj): {}", chunk.size(), e.getMessage());
                continue;
            }

            Object data = response == null ? null : response.get("data");
            if (!(data instanceof List<?> tickets)) continue;

            for (int i = 0; i < tickets.size() && i < chunk.size(); i++) {
                if (!(tickets.get(i) instanceof Map<?, ?> ticket)) continue;
                if (!"error".equals(ticket.get("status"))) continue;
                String error = ticket.get("details") instanceof Map<?, ?> details
                        ? String.valueOf(details.get("error"))
                        : null;
                if ("DeviceNotRegistered".equals(error)) {
                    dropToken(chunk.get(i).token());
                } else {
                    log.warn("Push reddedildi: {} ({})", ticket.get("message"), error);
                }
            }
        }
    }

    /** Ölü token'ı sil. Kendi işleminde çalışır: çağıran akışı etkilemez. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void dropToken(String token) {
        try {
            pushTokenRepository.deleteByToken(token);
            log.info("Kayıtsız cihaz token'ı silindi.");
        } catch (Exception e) {
            log.warn("Token silinemedi: {}", e.getMessage());
        }
    }

    /** Bir kullanıcının tüm cihazları. */
    public List<PushToken> tokensOf(Long userId) {
        return pushTokenRepository.findByUserId(userId);
    }

    @PreDestroy
    void shutdown() {
        executor.shutdown();
        try {
            if (!executor.awaitTermination(5, TimeUnit.SECONDS)) executor.shutdownNow();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            executor.shutdownNow();
        }
    }
}
