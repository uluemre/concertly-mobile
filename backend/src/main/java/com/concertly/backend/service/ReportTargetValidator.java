package com.concertly.backend.service;

import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.repository.CommentRepository;
import com.concertly.backend.repository.MessageRepository;
import com.concertly.backend.repository.PostRepository;
import com.concertly.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Set;

/**
 * Şikâyet isteği doğrulaması: tür beyaz listesi, hedefin varlığı ve neden uzunluğu.
 * Topluluk türlerinin (COMMUNITY_POST / COMMUNITY_COMMENT) hedef ve görünürlük denetimi
 * CommunityService.requireCanReportCommunityContent'te yapılır; burada yalnız tür kabul edilir.
 */
@Service
public class ReportTargetValidator {

    public static final int REASON_MAX = 500;
    static final Set<String> TYPES = Set.of("POST", "COMMENT", "USER", "MESSAGE",
            "COMMUNITY_POST", "COMMUNITY_COMMENT");

    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final UserRepository userRepository;
    private final MessageRepository messageRepository;

    public ReportTargetValidator(PostRepository postRepository,
                                 CommentRepository commentRepository,
                                 UserRepository userRepository,
                                 MessageRepository messageRepository) {
        this.postRepository = postRepository;
        this.commentRepository = commentRepository;
        this.userRepository = userRepository;
        this.messageRepository = messageRepository;
    }

    /** @param targetType zaten trim + büyük harf yapılmış tür */
    public void validate(String targetType, Long targetId, String reason) {
        if (targetType == null || !TYPES.contains(targetType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "REPORT_TYPE_INVALID");
        }
        if (targetId == null) {
            throw new IllegalArgumentException("REPORT_TARGET_MISSING");
        }
        if (reason != null && reason.length() > REASON_MAX) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "REASON_TOO_LONG");
        }
        boolean exists = switch (targetType) {
            case "POST" -> postRepository.existsById(targetId);
            case "COMMENT" -> commentRepository.existsById(targetId);
            case "USER" -> userRepository.existsById(targetId);
            case "MESSAGE" -> messageRepository.existsById(targetId);
            default -> true; // topluluk türleri CommunityService'te doğrulanır
        };
        if (!exists) {
            throw new ResourceNotFoundException("Şikayet hedefi bulunamadı: " + targetId);
        }
    }
}
