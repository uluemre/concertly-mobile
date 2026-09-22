package com.concertly.backend.service;

import com.concertly.backend.model.User;
import com.concertly.backend.repository.CommentRepository;
import com.concertly.backend.repository.MessageRepository;
import com.concertly.backend.repository.PostRepository;
import com.concertly.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

/**
 * Yeni hesaplara günlük üretim limiti.
 *
 * Spam hesapları açılır açılmaz onlarca gönderi/mesaj atar. Hesap belirli bir
 * yaşı geçene kadar (varsayılan 48 saat) günlük tavan uygulanır; sonrasında
 * limit kalkar. Amaç kötüye kullanımı yavaşlatmak, normal kullanıcıyı
 * engellemek değil — bu yüzden tavanlar cömert tutuldu.
 *
 * Limit aşımında 429 döner; istemci kullanıcıya kendi dilinde mesaj gösterir.
 */
@Service
public class ContentLimitService {

    private final UserRepository userRepository;
    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final MessageRepository messageRepository;

    private final long newAccountHours;
    private final long maxPosts;
    private final long maxComments;
    private final long maxMessages;

    public ContentLimitService(UserRepository userRepository,
            PostRepository postRepository,
            CommentRepository commentRepository,
            MessageRepository messageRepository,
            @Value("${app.moderation.new-account-hours:48}") long newAccountHours,
            @Value("${app.moderation.new-account-max-posts-per-day:10}") long maxPosts,
            @Value("${app.moderation.new-account-max-comments-per-day:50}") long maxComments,
            @Value("${app.moderation.new-account-max-messages-per-day:50}") long maxMessages) {
        this.userRepository = userRepository;
        this.postRepository = postRepository;
        this.commentRepository = commentRepository;
        this.messageRepository = messageRepository;
        this.newAccountHours = newAccountHours;
        this.maxPosts = maxPosts;
        this.maxComments = maxComments;
        this.maxMessages = maxMessages;
    }

    public void checkPost(Long userId) {
        if (!isNewAccount(userId)) return;
        if (postRepository.countByUserIdAndCreatedAtAfter(userId, since()) >= maxPosts) {
            throw tooMany("POST_LIMIT");
        }
    }

    public void checkComment(Long userId) {
        if (!isNewAccount(userId)) return;
        if (commentRepository.countByUserIdAndCreatedAtAfter(userId, since()) >= maxComments) {
            throw tooMany("COMMENT_LIMIT");
        }
    }

    public void checkMessage(Long userId) {
        if (!isNewAccount(userId)) return;
        if (messageRepository.countBySenderIdAndCreatedAtAfter(userId, since()) >= maxMessages) {
            throw tooMany("MESSAGE_LIMIT");
        }
    }

    /** Hesap yaşı bilinmiyorsa limit uygulanmaz — eski kayıtlar cezalandırılmasın. */
    public boolean isNewAccount(Long userId) {
        if (newAccountHours <= 0) return false;
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || user.getCreatedAt() == null) return false;
        return user.getCreatedAt().isAfter(LocalDateTime.now().minusHours(newAccountHours));
    }

    private LocalDateTime since() {
        return LocalDateTime.now().minusDays(1);
    }

    private ResponseStatusException tooMany(String reason) {
        return new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, reason);
    }
}
