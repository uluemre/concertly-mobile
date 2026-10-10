package com.concertly.backend.service.storage;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Veritabanında hâlâ kullanılan görsel anahtarlarını bulur. Belirli kolonlara
 * bakmak yerine tüm metin kolonlarını tarar (migrate-uploads-to-r2.mjs ile aynı
 * yöntem): ileride görsel tutan yeni bir kolon eklenince unutulup o görseller
 * yanlışlıkla silinmesin.
 */
@Component
public class UploadReferenceScanner {

    private final JdbcTemplate jdbc;

    public UploadReferenceScanner(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Set<String> referencedKeys() {
        List<String> cols = jdbc.queryForList("""
                select quote_ident(c.table_name) || '|' || quote_ident(c.column_name)
                from information_schema.columns c
                join information_schema.tables t
                  on t.table_schema = c.table_schema and t.table_name = c.table_name
                where c.table_schema = current_schema()
                  and t.table_type = 'BASE TABLE'
                  and c.data_type in ('text', 'character varying')
                  and c.table_name <> 'media_uploads'
                """, String.class);
        if (cols.isEmpty()) {
            // Şema okunamadıysa "hiçbir şey kullanılmıyor" sonucuna varma
            throw new IllegalStateException("metin kolonu bulunamadi");
        }
        String union = cols.stream().map(tc -> {
            String[] p = tc.split("\\|", 2);
            return "select (regexp_matches(" + p[1] + ", '/uploads/([A-Za-z0-9._-]+)', 'g'))[1] as k from "
                    + p[0] + " where " + p[1] + " like '%/uploads/%'";
        }).collect(Collectors.joining(" union all "));
        return new HashSet<>(jdbc.queryForList("select distinct k from (" + union + ") x", String.class));
    }
}
