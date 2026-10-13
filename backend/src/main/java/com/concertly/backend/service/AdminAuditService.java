package com.concertly.backend.service;

import com.concertly.backend.model.AdminAuditLog;
import com.concertly.backend.repository.AdminAuditLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Admin işlem kaydı. Yazma hiçbir zaman asıl işlemi bozmaz: tablo yoksa ya da DB hata
 * verirse yalnız günlüğe uyarı düşer.
 */
@Service
public class AdminAuditService {

    private static final Logger log = LoggerFactory.getLogger(AdminAuditService.class);
    private static final int MAX_DETAIL = 4000;

    private final AdminAuditLogRepository repository;

    public AdminAuditService(AdminAuditLogRepository repository) {
        this.repository = repository;
    }

    public void record(Long adminId, String adminName, String method, String path, int status, String detail) {
        try {
            AdminAuditLog row = new AdminAuditLog();
            row.setAdminId(adminId);
            row.setAdminName(adminName);
            row.setMethod(method);
            row.setPath(path.length() > 255 ? path.substring(0, 255) : path);
            row.setStatus(status);
            row.setDetail(detail != null && detail.length() > MAX_DETAIL ? detail.substring(0, MAX_DETAIL) : detail);
            row.setCreatedAt(LocalDateTime.now());
            repository.save(row);
        } catch (Exception e) {
            log.warn("Admin islem kaydi yazilamadi ({} {}): {}", method, path, e.getMessage());
        }
    }

    /** Son işlemler, yeniden eskiye. area verilirse yalnız o bölüm (ör. "users", "events"). */
    public Map<String, Object> list(int page, int size, String area) {
        PageRequest pr = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100));
        Page<AdminAuditLog> p = area == null || area.isBlank()
                ? repository.findAllByOrderByCreatedAtDesc(pr)
                : repository.findByPathStartingWithOrderByCreatedAtDesc("/api/admin/" + area, pr);
        List<Map<String, Object>> items = p.getContent().stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.getId());
            m.put("adminId", r.getAdminId());
            m.put("adminName", r.getAdminName());
            m.put("method", r.getMethod());
            m.put("path", r.getPath());
            m.put("status", r.getStatus());
            m.put("detail", r.getDetail());
            m.put("createdAt", r.getCreatedAt());
            return m;
        }).toList();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", items);
        out.put("page", p.getNumber());
        out.put("hasMore", p.hasNext());
        return out;
    }
}
