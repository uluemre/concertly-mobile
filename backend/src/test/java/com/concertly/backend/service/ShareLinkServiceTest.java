package com.concertly.backend.service;

import com.concertly.backend.config.ShareLinkConfig;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Paylaşım sayfası kullanıcı verisini HTML'e gömüyor; kaçış olmazsa bir
 * gönderi metni sayfaya script sokabilir.
 */
class ShareLinkServiceTest {

    private final ShareLinkConfig config = new ShareLinkConfig(
            "https://concertly-api.onrender.com/", "", "com.concertly.app", "com.concertly.app", "concertly");
    private final ShareLinkService service = new ShareLinkService(config);

    @Test
    void escapesScriptInUserContent() {
        String html = service.renderLandingPage("post/1",
                "<script>alert('x')</script>", "kötü <b>içerik</b>", null);

        assertFalse(html.contains("<script>alert"));
        assertTrue(html.contains("&lt;script&gt;"));
        assertFalse(html.contains("kötü <b>"));
    }

    @Test
    void buildsDeepLinkAndWebUrl() {
        String html = service.renderLandingPage("event/42", "Hadise", "Zorlu PSM", null);

        assertTrue(html.contains("concertly://event/42"));
        assertTrue(html.contains("https://concertly-api.onrender.com/event/42"));
    }

    /** App Store id yokken mağaza linki tanıtım sayfasına düşmeli. */
    @Test
    void fallsBackToPromoPageWithoutAppStoreId() {
        assertEquals("https://concertly-api.onrender.com/promo/", config.iosStoreUrl());
    }

    @Test
    void usesAppStoreWhenIdConfigured() {
        ShareLinkConfig withId = new ShareLinkConfig(
                "https://concertly-api.onrender.com", "6501234567",
                "com.concertly.app", "com.concertly.app", "concertly");
        assertEquals("https://apps.apple.com/app/id6501234567", withId.iosStoreUrl());
    }

    @Test
    void absolutizesRelativeUploadPaths() {
        assertEquals("https://concertly-api.onrender.com/uploads/a.jpg",
                config.absoluteImage("/uploads/a.jpg"));
        assertEquals("https://cdn.example.com/a.jpg", config.absoluteImage("https://cdn.example.com/a.jpg"));
        assertEquals("https://concertly-api.onrender.com/promo/og.png", config.absoluteImage(null));
    }

    @Test
    void truncateKeepsPreviewShort() {
        assertEquals("abc", ShareLinkService.truncate("  abc  ", 10));
        assertEquals(10, ShareLinkService.truncate("a".repeat(50), 10).length());
    }
}
