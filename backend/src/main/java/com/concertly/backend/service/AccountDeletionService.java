package com.concertly.backend.service;

import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.AccountDeletionFeedback;
import com.concertly.backend.model.Community;
import com.concertly.backend.model.CommunityMember;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.CommunityMemberRepository;
import com.concertly.backend.repository.CommunityRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import java.time.LocalDateTime;
import java.util.List;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Kullanıcının hesabını ve ona bağlı TÜM verisini kalıcı olarak siler
 * (App Store / Play "hesap silme" zorunluluğu). User entity'sinde cascade yok;
 * her ilişki karşı taraftan FK ile bağlı olduğu için silme FK-güvenli sırayla
 * yapılır: önce kullanıcının postlarına/community postlarına bağlı çocuklar
 * (başka kullanıcılara ait olabilir), sonra kullanıcının kendi içerik/etkileşimi,
 * en sonda kullanıcının kendisi. JPQL toplu silmede çok-seviyeli path join'i
 * yerine alt-sorgu kullanılır (Hibernate'de güvenli + taşınabilir).
 */
@Service
public class AccountDeletionService {

    private static final Logger log = LoggerFactory.getLogger(AccountDeletionService.class);

    @PersistenceContext
    private EntityManager em;

    private final CommunityRepository communityRepository;
    private final CommunityMemberRepository communityMemberRepository;
    private final NotificationService notificationService;
    private final PlatformTransactionManager transactionManager;

    public AccountDeletionService(CommunityRepository communityRepository,
                                  CommunityMemberRepository communityMemberRepository,
                                  NotificationService notificationService,
                                  PlatformTransactionManager transactionManager) {
        this.communityRepository = communityRepository;
        this.communityMemberRepository = communityMemberRepository;
        this.notificationService = notificationService;
        this.transactionManager = transactionManager;
    }

    /**
     * Silinen kullanıcının sahip olduğu her topluluk için halef seçer ve devreder.
     * Sıra: ACTIVE MODERATOR (en erken joinedAt, eşitlikte en küçük üyelik id), yoksa ACTIVE MEMBER
     * (aynı sıralama). Silinen kullanıcı, PENDING/INVITED/BANNED ve diğer tüm ACTIVE olmayan
     * statüler aday değildir; NULL rol MEMBER sayılır. Aday yoksa topluluk arşivlenir
     * (archivedAt=şimdi; owner'ı çağıran null yapar). Çağıranın transaction'ı içinde çalışır.
     */
    void transferOwnedCommunities(Long uid) {
        for (Community c : communityRepository.findByOwnerId(uid)) {
            CommunityMember successor = pickSuccessor(c.getId(), uid);
            if (successor == null) {
                // Aday yok: topluluk silinmez, ARŞİVLENİR (içerik/üyelikler kalır, yeni katılım kapanır).
                // Owner'ı çağıran, aşağıdaki toplu UPDATE ile null yapar.
                c.setArchivedAt(LocalDateTime.now());
                communityRepository.save(c);
                log.info("Topluluk {} sahibi (kullanıcı {}) silinirken devralacak aktif üye yok; topluluk arşivlendi", c.getId(), uid);
                continue;
            }
            successor.setRole("OWNER");
            communityMemberRepository.save(successor);
            c.setOwner(successor.getUser());
            communityRepository.save(c);
            log.info("Topluluk {} sahipliği kullanıcı {} -> {} devredildi", c.getId(), uid, successor.getUser().getId());
            notifyNewOwner(successor.getUser().getId(), c.getId(), c.getName());
        }
    }

    /**
     * Bildirim silme transaction'ı İÇİNDE gönderilmez (sendSystem içindeki bir DB hatası tx'i
     * rollback-only yapıp tüm silmeyi UnexpectedRollbackException ile bozabilir). Aktif bir
     * transaction synchronization varsa commit sonrasına ertelenir; rollback olursa gönderilmez.
     * Synchronization yoksa (düz birim test) hemen gönderilir.
     */
    private void notifyNewOwner(Long newOwnerId, Long communityId, String name) {
        Runnable send = () -> notificationService.sendSystem(newOwnerId, "community_ownership", "community", communityId,
                "\"" + name + "\" toplulugunun sahipligi size devredildi.");
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    try {
                        // afterCommit'te eski (commit edilmiş) tx'e katılınır, yazılan satır kaybolur:
                        // bu yüzden yeni bir transaction açılır.
                        TransactionTemplate tt = new TransactionTemplate(transactionManager);
                        tt.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
                        tt.executeWithoutResult(status -> send.run());
                    } catch (RuntimeException e) {
                        log.warn("Devir bildirimi gönderilemedi (topluluk {}): {}", communityId, e.getMessage());
                    }
                }
            });
        } else {
            send.run();
        }
    }

    CommunityMember pickSuccessor(Long communityId, Long excludeUserId) {
        for (String role : new String[]{"MODERATOR", "MEMBER"}) {
            List<CommunityMember> found = communityMemberRepository.findSuccessorCandidates(
                    communityId, excludeUserId, role, PageRequest.of(0, 1));
            if (found != null && !found.isEmpty()) return found.get(0);
        }
        return null;
    }

    private int del(String jpql, Long uid) {
        return em.createQuery(jpql).setParameter("uid", uid).executeUpdate();
    }

    @Transactional
    public void deleteAccount(Long uid, String reason, String details) {
        if (em.find(User.class, uid) == null) {
            throw new ResourceNotFoundException("Kullanıcı bulunamadı: " + uid);
        }

        // Geri bildirimi önce sakla — kullanıcıya FK'sı yok, anonim kalır ve silmeden
        // bağımsızdır. details çok uzunsa kolona sığacak şekilde kırpılır.
        String trimmedDetails = (details != null && details.length() > 500)
                ? details.substring(0, 500) : details;
        em.persist(new AccountDeletionFeedback(reason, trimmedDetails));

        // 1) Kullanıcının POSTLARINA bağlı çocuklar (başkalarına ait olabilir)
        del("DELETE FROM Like l WHERE l.post.id IN (SELECT p.id FROM Post p WHERE p.user.id = :uid)", uid);
        del("DELETE FROM Comment c WHERE c.post.id IN (SELECT p.id FROM Post p WHERE p.user.id = :uid)", uid);
        del("DELETE FROM Media m WHERE m.post.id IN (SELECT p.id FROM Post p WHERE p.user.id = :uid)", uid);
        del("DELETE FROM PollVote pv WHERE pv.pollOption.id IN " +
                "(SELECT po.id FROM PollOption po WHERE po.post.id IN " +
                "(SELECT p.id FROM Post p WHERE p.user.id = :uid))", uid);
        del("DELETE FROM PollOption po WHERE po.post.id IN (SELECT p.id FROM Post p WHERE p.user.id = :uid)", uid);

        // 2) Kullanıcının COMMUNITY POSTLARINA bağlı çocuklar
        del("DELETE FROM CommunityPostLike cpl WHERE cpl.communityPost.id IN " +
                "(SELECT cp.id FROM CommunityPost cp WHERE cp.user.id = :uid)", uid);
        del("DELETE FROM CommunityPostComment cpc WHERE cpc.communityPost.id IN " +
                "(SELECT cp.id FROM CommunityPost cp WHERE cp.user.id = :uid)", uid);
        del("DELETE FROM CommunityPostPollVote v WHERE v.pollOption.communityPost.id IN " +
                "(SELECT cp.id FROM CommunityPost cp WHERE cp.user.id = :uid)", uid);
        del("DELETE FROM CommunityPostPollOption o WHERE o.communityPost.id IN " +
                "(SELECT cp.id FROM CommunityPost cp WHERE cp.user.id = :uid)", uid);

        // 3) Kullanıcının kendi etkileşimleri ve içerikleri
        del("DELETE FROM Like l WHERE l.user.id = :uid", uid);
        del("DELETE FROM Comment c WHERE c.user.id = :uid", uid);
        del("DELETE FROM PollVote pv WHERE pv.user.id = :uid", uid);
        del("DELETE FROM CommunityPostLike cpl WHERE cpl.user.id = :uid", uid);
        del("DELETE FROM CommunityPostComment cpc WHERE cpc.user.id = :uid", uid);
        del("DELETE FROM CommunityPostPollVote v WHERE v.user.id = :uid", uid);
        del("DELETE FROM Post p WHERE p.user.id = :uid", uid);
        del("DELETE FROM CommunityPost cp WHERE cp.user.id = :uid", uid);
        // Kullanıcının sahip olduğu topluluklar silinmez: önce sahiplik uygun üyeye devredilir,
        // aday yoksa sahibi boşaltılır (Event ile aynı mantık)
        transferOwnedCommunities(uid);
        em.flush();
        del("UPDATE Community c SET c.owner = null WHERE c.owner.id = :uid", uid);
        del("DELETE FROM CommunityMember cm WHERE cm.user.id = :uid", uid);
        del("DELETE FROM EventAttendance ea WHERE ea.user.id = :uid", uid);
        del("DELETE FROM EventBookmark eb WHERE eb.user.id = :uid", uid);
        del("DELETE FROM EventVerification ev WHERE ev.user.id = :uid", uid);
        del("DELETE FROM EventReview er WHERE er.user.id = :uid", uid);
        del("DELETE FROM ArtistReview ar WHERE ar.user.id = :uid", uid);
        del("DELETE FROM VenueReview vr WHERE vr.user.id = :uid", uid);
        del("DELETE FROM ArtistFollow af WHERE af.user.id = :uid", uid);
        del("DELETE FROM ConcertBuddy cb WHERE cb.user.id = :uid", uid);
        del("DELETE FROM QuizScore q WHERE q.user.id = :uid", uid);
        del("DELETE FROM DailySongPlay d WHERE d.user.id = :uid", uid);
        del("DELETE FROM SetlistSubmission s WHERE s.user.id = :uid", uid);
        del("DELETE FROM BingoCard bc WHERE bc.user.id = :uid", uid);
        del("DELETE FROM UserBadge ub WHERE ub.user.id = :uid", uid);
        del("DELETE FROM SpotifyConnection sc WHERE sc.user.id = :uid", uid);
        del("DELETE FROM RefreshToken rt WHERE rt.user.id = :uid", uid);
        // Cihaz push kayıtları ve organizatör başvuruları: telefonda giriş yapan her hesapta
        // push token olduğu için bunlar yokken silme FK hatasıyla 409 dönüyordu
        del("DELETE FROM PushToken pt WHERE pt.user.id = :uid", uid);
        del("DELETE FROM OrganizerRequest o WHERE o.user.id = :uid", uid);

        // 4) Karşılıklı/gelen referanslar (başkaları kullanıcıya bağlı)
        del("DELETE FROM Follow f WHERE f.follower.id = :uid OR f.following.id = :uid", uid);
        del("DELETE FROM Message m WHERE m.sender.id = :uid OR m.receiver.id = :uid", uid);
        del("DELETE FROM Notification n WHERE n.recipient.id = :uid OR n.actor.id = :uid", uid);
        del("DELETE FROM Block b WHERE b.blocker.id = :uid OR b.blocked.id = :uid", uid);
        del("DELETE FROM Report r WHERE r.reporter.id = :uid", uid);
        // BuddySwipe Long alanlar tutuyor (FK yok), yine de temizle
        del("DELETE FROM BuddySwipe bs WHERE bs.swiperId = :uid OR bs.targetId = :uid", uid);

        // 5) Kullanıcının oluşturduğu etkinlikler silinmez, yalnızca sahibi boşaltılır
        del("UPDATE Event e SET e.createdBy = null WHERE e.createdBy.id = :uid", uid);

        // 6) Kullanıcının kendisi (user_roles join'i em.remove ile otomatik temizlenir)
        User managed = em.find(User.class, uid);
        if (managed != null) em.remove(managed);
    }
}
