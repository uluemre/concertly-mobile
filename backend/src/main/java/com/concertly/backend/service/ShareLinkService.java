package com.concertly.backend.service;

import com.concertly.backend.config.ShareLinkConfig;
import org.springframework.stereotype.Service;

/**
 * Paylaşım linklerinin açılış sayfasını üretir.
 *
 * Sayfanın iki işi var:
 * 1. Link önizlemesi (og etiketleri) — WhatsApp/Instagram/X'te kart görünsün.
 * 2. Uygulamayı açmak; yüklü değilse mağazaya/tanıtım sayfasına düşmek.
 *
 * İçeriğin tamamı kullanıcı verisinden gelebildiği için HTML'e gömülen her
 * değer {@link #escapeHtml} ile kaçırılır — aksi halde bir gönderi metni
 * sayfaya script sokabilirdi.
 */
@Service
public class ShareLinkService {

    private final ShareLinkConfig config;

    public ShareLinkService(ShareLinkConfig config) {
        this.config = config;
    }

    /**
     * @param deepPath uygulama içi yol, örn. "event/123"
     * @param title    kartta ve og:title'da görünecek başlık
     * @param subtitle açıklama satırı
     * @param imageUrl kart görseli (göreli olabilir)
     */
    public String renderLandingPage(String deepPath, String title, String subtitle, String imageUrl) {
        String safeTitle = escapeHtml(title == null || title.isBlank() ? "Concertly" : title);
        String safeSubtitle = escapeHtml(subtitle == null ? "" : subtitle);
        String safeImage = escapeHtml(config.absoluteImage(imageUrl));
        String deepLink = escapeHtml(config.getAppScheme() + "://" + deepPath);
        String webUrl = escapeHtml(config.getBaseUrl() + "/" + deepPath);
        String iosStore = escapeHtml(config.iosStoreUrl());
        String androidStore = escapeHtml(config.androidStoreUrl());

        return """
                <!DOCTYPE html>
                <html lang="tr">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <title>%1$s · Concertly</title>
                  <meta property="og:type" content="website">
                  <meta property="og:site_name" content="Concertly">
                  <meta property="og:title" content="%1$s">
                  <meta property="og:description" content="%2$s">
                  <meta property="og:image" content="%3$s">
                  <meta property="og:url" content="%5$s">
                  <meta name="twitter:card" content="summary_large_image">
                  <meta name="twitter:title" content="%1$s">
                  <meta name="twitter:description" content="%2$s">
                  <meta name="twitter:image" content="%3$s">
                  <style>
                    :root {
                      --bg: #0F0F1A; --card: #1A1A2E; --primary: #E94560;
                      --purple: #7C3AED; --text: #FFFFFF; --muted: #A0A0B0; --border: #2A2A3E;
                    }
                    * { box-sizing: border-box; }
                    body {
                      margin: 0; min-height: 100vh; background: var(--bg); color: var(--text);
                      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                      display: flex; align-items: center; justify-content: center; padding: 24px;
                    }
                    .card {
                      width: 100%%; max-width: 420px; background: var(--card);
                      border: 1px solid var(--border); border-radius: 20px; overflow: hidden;
                    }
                    .cover { width: 100%%; aspect-ratio: 16/9; object-fit: cover; display: block; background: #12121f; }
                    .body { padding: 22px; }
                    h1 { margin: 0 0 8px; font-size: 1.35rem; line-height: 1.3; }
                    p { margin: 0 0 20px; color: var(--muted); font-size: .95rem; line-height: 1.5; }
                    a.btn {
                      display: block; text-align: center; padding: 14px 18px; border-radius: 12px;
                      text-decoration: none; font-weight: 700; margin-bottom: 10px;
                    }
                    .primary { background: linear-gradient(90deg, var(--purple), var(--primary)); color: #fff; }
                    .ghost { border: 1px solid var(--border); color: var(--text); }
                    .foot { text-align: center; color: var(--muted); font-size: .78rem; margin-top: 14px; }
                  </style>
                </head>
                <body>
                  <main class="card">
                    <img class="cover" src="%3$s" alt="">
                    <div class="body">
                      <h1>%1$s</h1>
                      <p>%2$s</p>
                      <a class="btn primary" id="open" href="%4$s">Uygulamada aç</a>
                      <a class="btn ghost" id="store" href="%6$s">Concertly'yi indir</a>
                      <div class="foot">Concertly · konserleri keşfet, gittiğini kanıtla</div>
                    </div>
                  </main>
                  <script>
                    (function () {
                      var ua = navigator.userAgent || '';
                      var isIOS = /iPad|iPhone|iPod/.test(ua);
                      var isAndroid = /Android/.test(ua);
                      var store = isIOS ? '%6$s' : (isAndroid ? '%7$s' : '%8$s');
                      document.getElementById('store').href = store;
                      if (!isIOS && !isAndroid) return;

                      // Uygulamayı açmayı dene. Açılırsa sayfa arka plana düşer ve
                      // zamanlayıcı çalışmaz; açılmazsa mağazaya yönlendiririz.
                      var start = Date.now();
                      var timer = setTimeout(function () {
                        if (document.hidden || Date.now() - start > 2200) return;
                        window.location.replace(store);
                      }, 1400);
                      document.addEventListener('visibilitychange', function () {
                        if (document.hidden) clearTimeout(timer);
                      });
                      window.location.href = '%4$s';
                    })();
                  </script>
                </body>
                </html>
                """.formatted(safeTitle, safeSubtitle, safeImage, deepLink, webUrl,
                iosStore, androidStore, escapeHtml(config.getBaseUrl() + "/promo/"));
    }

    /** HTML/attribute bağlamı için minimum kaçış seti. */
    public static String escapeHtml(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    /** Uzun metinleri kart açıklamasına sığacak hale getirir. */
    public static String truncate(String value, int max) {
        if (value == null) return "";
        String clean = value.replaceAll("\\s+", " ").trim();
        return clean.length() <= max ? clean : clean.substring(0, max - 1) + "…";
    }
}
