package com.concertly.backend.model;

import jakarta.persistence.Column;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

/** Mobilin izin verdiği uzunluk (500/300) veritabanına sığmalı; fazlası sunucuda reddedilmeli. */
class ContentLengthTest {

    private static int columnLength(Class<?> type) throws Exception {
        Column c = type.getDeclaredField("content").getAnnotation(Column.class);
        assertNotNull(c, type.getSimpleName() + ".content için @Column yok");
        return c.length();
    }

    @Test
    void columnsFitTheMobileLimits() throws Exception {
        assertTrue(columnLength(Post.class) >= ContentLimits.POST_MAX);
        assertTrue(columnLength(Comment.class) >= ContentLimits.COMMENT_MAX);
        assertTrue(columnLength(CommunityPost.class) >= ContentLimits.COMMUNITY_POST_MAX);
        assertEquals(500, ContentLimits.POST_MAX, "mobil CreatePost maxLength=500");
        assertEquals(300, ContentLimits.COMMENT_MAX, "mobil PostDetail maxLength=300");
    }

    @Test
    void textsUpToTheLimitPassAndLongerOnesAreRejected() {
        assertDoesNotThrow(() -> ContentLimits.check("a".repeat(500), ContentLimits.POST_MAX));
        assertDoesNotThrow(() -> ContentLimits.check("a".repeat(300), ContentLimits.COMMENT_MAX));
        assertDoesNotThrow(() -> ContentLimits.check(null, ContentLimits.POST_MAX));

        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> ContentLimits.check("a".repeat(501), ContentLimits.POST_MAX));
        assertEquals("CONTENT_TOO_LONG", e.getReason());
        assertThrows(ResponseStatusException.class,
                () -> ContentLimits.check("a".repeat(301), ContentLimits.COMMENT_MAX));
    }

    @Test
    void migrationWidensAllThreeColumnsWithoutTouchingData() throws Exception {
        String sql = Files.readString(Path.of("src/main/resources/db/migration/V6__reset_attempts_and_content_length.sql"));
        for (String table : new String[]{"posts", "comments", "community_posts"}) {
            assertTrue(sql.contains("ALTER TABLE " + table + " ALTER COLUMN content TYPE VARCHAR(" + ContentLimits.COLUMN_LENGTH + ")"),
                    table + " genişletilmeli");
        }
        // Yalnızca SQL satırları (açıklamalar "ddl-auto=update" gibi kelimeler içeriyor)
        String upper = sql.lines().filter(l -> !l.trim().startsWith("--"))
                .reduce("", (a, b) -> a + "\n" + b).toUpperCase();
        assertFalse(upper.contains("DELETE") || upper.contains("DROP") || upper.contains("TRUNCATE") || upper.contains("UPDATE "),
                "migration veri silmemeli/değiştirmemeli");
    }
}
