package com.concertly.backend.service;

import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.FollowRepository;
import com.concertly.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Collection;
import java.util.HashSet;
import java.util.Set;

/**
 * SEC-05 "Özel Hesap": bir kullanıcının içeriğini (gönderiler, etkinlikler, pasaport,
 * takip listeleri, rozetler...) kimin görebileceğine karar verir.
 *
 * Görebilen: hesap açıksa herkes; özelse yalnızca kendisi, KABUL EDİLMİŞ takipçileri ve admin.
 * Engel kuralları bu sınıfın işi değildir — çağıran önce ModerationService.requireVisible uygular.
 */
@Service
public class PrivacyService {

    /** İstemcinin çevirdiği hata kodu. */
    public static final String PRIVATE_ACCOUNT = "PRIVATE_ACCOUNT";

    private final FollowRepository followRepository;
    private final UserRepository userRepository;

    public PrivacyService(FollowRepository followRepository, UserRepository userRepository) {
        this.followRepository = followRepository;
        this.userRepository = userRepository;
    }

    public static boolean isPrivate(User user) {
        return user != null && Boolean.TRUE.equals(user.getPrivateAccount());
    }

    public boolean canViewContent(Long viewerId, User owner) {
        if (!isPrivate(owner)) return true;
        if (viewerId == null) return false;
        if (viewerId.equals(owner.getId())) return true;
        if (followRepository.isAcceptedFollower(viewerId, owner.getId())) return true;
        return isAdmin(viewerId);
    }

    public boolean canViewContent(Long viewerId, Long ownerId) {
        User owner = userRepository.findById(ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + ownerId));
        return canViewContent(viewerId, owner);
    }

    /** Yetkisizse 403 PRIVATE_ACCOUNT (profil alt kaynakları için). */
    public void requireCanViewContent(Long viewerId, User owner) {
        if (!canViewContent(viewerId, owner)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, PRIVATE_ACCOUNT);
        }
    }

    public void requireCanViewContent(Long viewerId, Long ownerId) {
        if (!canViewContent(viewerId, ownerId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, PRIVATE_ACCOUNT);
        }
    }

    /**
     * Liste süzgeci (N+1 yok): verilen sahipler arasından, bu izleyicinin İÇERİĞİNİ GÖREMEDİĞİ
     * özel hesapların id'leri. Açık hesaplar, kendisi, admin ve kabul edilmiş takip edilenler dahil değil.
     */
    public Set<Long> restrictedOwnerIds(Long viewerId, Collection<User> owners) {
        Set<Long> privateIds = new HashSet<>();
        for (User o : owners) {
            if (o != null && o.getId() != null && isPrivate(o) && !o.getId().equals(viewerId)) {
                privateIds.add(o.getId());
            }
        }
        if (privateIds.isEmpty() || viewerId == null) return privateIds;
        if (isAdmin(viewerId)) return new HashSet<>();
        privateIds.removeAll(followRepository.findAcceptedFollowingIds(viewerId, privateIds));
        return privateIds;
    }

    public boolean isAdmin(Long userId) {
        if (userId == null) return false;
        return userRepository.findById(userId)
                .map(u -> u.getRoles() != null && u.getRoles().stream()
                        .anyMatch(r -> "ROLE_ADMIN".equals(r.getName())))
                .orElse(false);
    }
}
