package com.concertly.backend.service;

import com.concertly.backend.dto.response.BlockedUserResponse;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Block;
import com.concertly.backend.model.Report;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.BlockRepository;
import com.concertly.backend.repository.ReportRepository;
import com.concertly.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class ModerationService {

    private final BlockRepository blockRepository;
    private final ReportRepository reportRepository;
    private final UserRepository userRepository;

    public ModerationService(BlockRepository blockRepository,
                             ReportRepository reportRepository,
                             UserRepository userRepository) {
        this.blockRepository = blockRepository;
        this.reportRepository = reportRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public void block(Long blockerId, Long blockedId) {
        if (blockerId.equals(blockedId)) {
            throw new IllegalArgumentException("Kendini engelleyemezsin");
        }
        if (blockRepository.existsByBlockerIdAndBlockedId(blockerId, blockedId)) {
            return; // zaten engelli — idempotent
        }
        User blocker = userRepository.findById(blockerId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + blockerId));
        User blocked = userRepository.findById(blockedId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + blockedId));
        Block b = new Block();
        b.setBlocker(blocker);
        b.setBlocked(blocked);
        blockRepository.save(b);
    }

    @Transactional
    public void unblock(Long blockerId, Long blockedId) {
        blockRepository.findByBlockerIdAndBlockedId(blockerId, blockedId)
                .ifPresent(blockRepository::delete);
    }

    public boolean isBlocking(Long blockerId, Long blockedId) {
        return blockRepository.existsByBlockerIdAndBlockedId(blockerId, blockedId);
    }

    public List<BlockedUserResponse> getBlockedUsers(Long blockerId) {
        return blockRepository.findByBlockerIdOrderByCreatedAtDesc(blockerId).stream()
                .map(b -> BlockedUserResponse.from(b.getBlocked()))
                .toList();
    }

    /**
     * İçerik filtrelemesi için: kullanıcının engellediği + onu engelleyen herkesin id'leri.
     * Her iki yön de gizlenir (engellediğim kişiyi de, beni engelleyeni de görmem).
     */
    public Set<Long> getHiddenUserIds(Long userId) {
        if (userId == null) return Set.of();
        Set<Long> ids = new HashSet<>(blockRepository.findBlockedIds(userId));
        ids.addAll(blockRepository.findBlockerIds(userId));
        return ids;
    }

    @Transactional
    public void report(Long reporterId, String targetType, Long targetId, String reason) {
        if (targetType == null || targetId == null) {
            throw new IllegalArgumentException("Şikayet hedefi eksik");
        }
        // Aynı hedef için mükerrer şikayeti engelle
        if (reportRepository.existsByReporterIdAndTargetTypeAndTargetId(reporterId, targetType, targetId)) {
            return;
        }
        User reporter = userRepository.findById(reporterId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + reporterId));
        Report r = new Report();
        r.setReporter(reporter);
        r.setTargetType(targetType);
        r.setTargetId(targetId);
        r.setReason(reason);
        reportRepository.save(r);
    }

    public List<Report> getOpenReports() {
        return reportRepository.findByResolvedFalseOrderByCreatedAtDesc();
    }
}
