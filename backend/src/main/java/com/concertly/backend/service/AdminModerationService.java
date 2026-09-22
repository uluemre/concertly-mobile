package com.concertly.backend.service;

import com.concertly.backend.dto.response.ReportResponse;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Comment;
import com.concertly.backend.model.Message;
import com.concertly.backend.model.Post;
import com.concertly.backend.model.Report;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.CommentRepository;
import com.concertly.backend.repository.MessageRepository;
import com.concertly.backend.repository.PostRepository;
import com.concertly.backend.repository.ReportRepository;
import com.concertly.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * Admin moderasyon işlemleri: şikayet kuyruğu, içerik gizleme, kullanıcı askıya alma.
 *
 * Gizleme SİLME DEĞİLDİR: içerik akıştan düşer ama kayıt kalır. Şikayet yanlış
 * çıkarsa geri alınabilir, doğruysa denetim izi elde kalır.
 *
 * Şikayet edilen DM'in metni burada moderatöre gösterilir — taciz şikayetini
 * incelemenin başka yolu yok; yalnızca AÇIKÇA ŞİKAYET EDİLEN mesaj okunur,
 * sohbetin tamamı değil.
 */
@Service
public class AdminModerationService {

    private static final int PREVIEW_LENGTH = 200;

    private final ReportRepository reportRepository;
    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;

    public AdminModerationService(ReportRepository reportRepository,
            PostRepository postRepository,
            CommentRepository commentRepository,
            MessageRepository messageRepository,
            UserRepository userRepository) {
        this.reportRepository = reportRepository;
        this.postRepository = postRepository;
        this.commentRepository = commentRepository;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
    }

    /** Açık şikayetler (en yeni önce). resolved=true ile kapatılmışlar da listelenir. */
    public List<ReportResponse> getReports(boolean includeResolved) {
        List<Report> reports = includeResolved
                ? reportRepository.findAll().stream()
                        .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                        .toList()
                : reportRepository.findByResolvedFalseOrderByCreatedAtDesc();
        return reports.stream().map(this::enrich).toList();
    }

    private ReportResponse enrich(Report r) {
        String type = r.getTargetType() == null ? "" : r.getTargetType().toUpperCase();
        Long id = r.getTargetId();
        switch (type) {
            case "POST" -> {
                Post p = postRepository.findById(id).orElse(null);
                if (p == null) return ReportResponse.from(r, "(gönderi silinmiş)", false, null, null);
                return ReportResponse.from(r, preview(p.getContent()), p.getIsHidden(),
                        owner(p.getUser()), username(p.getUser()));
            }
            case "COMMENT" -> {
                Comment c = commentRepository.findById(id).orElse(null);
                if (c == null) return ReportResponse.from(r, "(yorum silinmiş)", false, null, null);
                return ReportResponse.from(r, preview(c.getContent()), c.getIsHidden(),
                        owner(c.getUser()), username(c.getUser()));
            }
            case "MESSAGE" -> {
                Message m = messageRepository.findById(id).orElse(null);
                if (m == null) return ReportResponse.from(r, "(mesaj silinmiş)", false, null, null);
                return ReportResponse.from(r, preview(m.getContent()), false,
                        owner(m.getSender()), username(m.getSender()));
            }
            case "USER" -> {
                User u = userRepository.findById(id).orElse(null);
                if (u == null) return ReportResponse.from(r, "(kullanıcı silinmiş)", false, null, null);
                return ReportResponse.from(r, "@" + u.getUsername(),
                        !Boolean.TRUE.equals(u.getIsActive()), u.getId(), u.getUsername());
            }
            default -> {
                return ReportResponse.from(r, null, false, null, null);
            }
        }
    }

    /** Şikayeti kapat. Kullanıcı bildirimi yok — moderasyon kararları sessizdir. */
    @Transactional
    public void resolveReport(Long reportId) {
        Report report = reportRepository.findById(reportId)
                .orElseThrow(() -> new ResourceNotFoundException("Şikayet bulunamadı: " + reportId));
        report.setResolved(true);
        reportRepository.save(report);
    }

    /**
     * İçeriği gizler/geri açar. POST ve COMMENT desteklenir; USER için hesap
     * askıya alma ayrı uçtan yapılır, mesajlar ise zaten yalnızca iki kişi arasında.
     */
    @Transactional
    public void setContentHidden(String targetType, Long targetId, boolean hidden) {
        String type = targetType == null ? "" : targetType.toUpperCase();
        switch (type) {
            case "POST" -> {
                Post p = postRepository.findById(targetId)
                        .orElseThrow(() -> new ResourceNotFoundException("Gönderi bulunamadı: " + targetId));
                p.setIsHidden(hidden);
                postRepository.save(p);
            }
            case "COMMENT" -> {
                Comment c = commentRepository.findById(targetId)
                        .orElseThrow(() -> new ResourceNotFoundException("Yorum bulunamadı: " + targetId));
                c.setIsHidden(hidden);
                commentRepository.save(c);
            }
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Gizleme yalnızca POST ve COMMENT için geçerli.");
        }
    }

    private String preview(String content) {
        return ShareLinkService.truncate(content, PREVIEW_LENGTH);
    }

    private Long owner(User u) { return u == null ? null : u.getId(); }

    private String username(User u) { return u == null ? null : u.getUsername(); }
}
