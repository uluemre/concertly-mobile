package com.concertly.backend.service;

import com.concertly.backend.dto.response.NotificationResponse;
import com.concertly.backend.model.Notification;
import com.concertly.backend.model.PushCategory;
import com.concertly.backend.model.PushToken;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.NotificationRepository;
import com.concertly.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final ExpoPushService pushService;
    private final PushMessageFactory pushMessageFactory;

    public NotificationService(NotificationRepository notificationRepository,
                                UserRepository userRepository,
                                ExpoPushService pushService,
                                PushMessageFactory pushMessageFactory) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.pushService = pushService;
        this.pushMessageFactory = pushMessageFactory;
    }

    /**
     * Geri alınıp tekrarlanabilen (idempotent) eylemler: beğen/geri al/tekrar beğen ya da
     * takip/bırak/takip aynı bildirimi ve push'u yeniden üretmesin (N-30). Yorum, mesaj,
     * davet gibi her seferinde yeni olay sayılan türler bu listede DEĞİL.
     * Tekrar yalnız {@link #REPEAT_WINDOW} içinde bastırılır: bir hafta sonra yeniden
     * beğenen/takip eden kişi için bildirim yine gelir (Emre kararı, 5 Eki 2026).
     */
    private static final java.util.Set<String> ONCE_PER_ACTOR_TYPES = java.util.Set.of("like", "follow", "follow_request");
    static final java.time.Duration REPEAT_WINDOW = java.time.Duration.ofDays(7);

    public void send(Long recipientId, Long actorId, String type, String entityType, Long entityId) {
        try {
            if (recipientId.equals(actorId)) return;
            if (ONCE_PER_ACTOR_TYPES.contains(type) && notificationRepository
                    .existsByRecipientIdAndActorIdAndTypeAndEntityIdAndCreatedAtAfter(recipientId, actorId, type, entityId,
                            java.time.LocalDateTime.now().minus(REPEAT_WINDOW))) return;
            User recipient = userRepository.findById(recipientId).orElseThrow();
            User actor     = userRepository.findById(actorId).orElseThrow();
            Notification n = new Notification();
            n.setRecipient(recipient);
            n.setActor(actor);
            n.setType(type);
            n.setEntityType(entityType);
            n.setEntityId(entityId);
            notificationRepository.save(n);
            push(recipient, n);
        } catch (Exception ignored) {}
    }

    /**
     * Sahip bir takip isteğini kabul/reddedince eski "follow_request" bildirimini siler; böylece aynı
     * kişinin sonraki isteği sahibine yeniden bildirilebilir. İstek sahibi İPTAL edince çağrılmaz
     * (iptal/yeniden-iste spam'i engelli kalır).
     */
    @Transactional
    public void clearFollowRequest(Long ownerId, Long requesterId) {
        notificationRepository.deleteByRecipientIdAndActorIdAndType(ownerId, requesterId, "follow_request");
    }

    /** Aktörsüz sistem bildirimi (turne duyurusu, konser hatırlatması vb.). Aynı bildirimi tekrar göndermez. */
    public void sendSystem(Long recipientId, String type, String entityType, Long entityId, String message) {
        try {
            if (notificationRepository.existsByRecipientIdAndTypeAndEntityId(recipientId, type, entityId)) return;
            User recipient = userRepository.findById(recipientId).orElseThrow();
            Notification n = new Notification();
            n.setRecipient(recipient);
            n.setType(type);
            n.setEntityType(entityType);
            n.setEntityId(entityId);
            n.setMessage(message);
            notificationRepository.save(n);
            push(recipient, n);
        } catch (Exception ignored) {}
    }

    /**
     * Kayıtlı bildirimi cihazlara da düşürür.
     *
     * Metin burada — yani hâlâ transaction içindeyken — hazırlanır; gönderimin
     * kendisi arka plana atılır. Böylece Expo yavaş olduğunda beğeni/yorum
     * isteği beklemez, lazy alan sorunu da yaşanmaz.
     */
    private void push(User recipient, Notification n) {
        try {
            PushCategory category = PushCategory.of(n.getType());
            if (!category.isEnabledFor(recipient)) return;

            List<PushToken> tokens = pushService.tokensOf(recipient.getId());
            if (tokens.isEmpty()) return;

            long badge = getUnreadCount(recipient.getId());
            Map<String, Object> data = new HashMap<>();
            data.put("notificationId", n.getId());
            data.put("type", n.getType());
            data.put("entityType", n.getEntityType());
            data.put("entityId", n.getEntityId());
            if (n.getActor() != null) {
                data.put("actorId", n.getActor().getId());
                data.put("actorUsername", n.getActor().getUsername());
            }

            List<ExpoPushService.Message> messages = new ArrayList<>(tokens.size());
            for (PushToken token : tokens) {
                String[] text = pushMessageFactory.build(n, token.getLanguage());
                if (text[1] == null || text[1].isBlank()) continue;
                messages.add(new ExpoPushService.Message(token.getToken(), text[0], text[1], data, badge));
            }
            pushService.sendAsync(messages);
        } catch (Exception ignored) {}
    }

    public List<NotificationResponse> getForUser(Long userId) {
        return notificationRepository.findByRecipientIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(NotificationResponse::from)
                .toList();
    }

    public long getUnreadCount(Long userId) {
        return notificationRepository.countByRecipientIdAndIsReadFalse(userId);
    }

    @Transactional
    public void markRead(Long notificationId, Long userId) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            if (n.getRecipient().getId().equals(userId)) {
                n.setIsRead(true);
                notificationRepository.save(n);
            }
        });
    }

    @Transactional
    public void markAllRead(Long userId) {
        notificationRepository.findByRecipientIdOrderByCreatedAtDesc(userId)
                .forEach(n -> {
                    if (!n.getIsRead()) {
                        n.setIsRead(true);
                        notificationRepository.save(n);
                    }
                });
    }
}
