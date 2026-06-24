package com.concertly.backend.service;

import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.AccountDeletionFeedback;
import com.concertly.backend.model.User;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    @PersistenceContext
    private EntityManager em;

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
        // Kullanıcının sahip olduğu topluluklar silinmez, sahibi boşaltılır (Event ile aynı mantık)
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
