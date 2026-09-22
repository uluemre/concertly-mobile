package com.concertly.backend.controller;

import com.concertly.backend.config.ShareLinkConfig;
import com.concertly.backend.model.Community;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.Post;
import com.concertly.backend.model.User;
import com.concertly.backend.model.Artist;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.CommunityRepository;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.PostRepository;
import com.concertly.backend.repository.UserRepository;
import com.concertly.backend.service.ShareLinkService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * Paylaşılabilir kısa linkler: /e/{id} etkinlik, /a/{id} sanatçı,
 * /u/{kullanıcıadı} profil, /p/{id} gönderi, /c/{id} topluluk.
 *
 * Kimlik doğrulaması YOK — linki alan kişi henüz kullanıcı değil; amaç zaten
 * onu uygulamaya getirmek. Bu yüzden sayfada yalnızca herkese açık alanlar
 * gösterilir (ad, görsel, tarih), e-posta/telefon gibi veriler asla.
 */
@RestController
public class ShareController {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("d MMMM yyyy · HH:mm");

    private final EventRepository eventRepository;
    private final ArtistRepository artistRepository;
    private final UserRepository userRepository;
    private final PostRepository postRepository;
    private final CommunityRepository communityRepository;
    private final ShareLinkService shareLinkService;
    private final ShareLinkConfig shareLinkConfig;

    public ShareController(EventRepository eventRepository,
            ArtistRepository artistRepository,
            UserRepository userRepository,
            PostRepository postRepository,
            CommunityRepository communityRepository,
            ShareLinkService shareLinkService,
            ShareLinkConfig shareLinkConfig) {
        this.eventRepository = eventRepository;
        this.artistRepository = artistRepository;
        this.userRepository = userRepository;
        this.postRepository = postRepository;
        this.communityRepository = communityRepository;
        this.shareLinkService = shareLinkService;
        this.shareLinkConfig = shareLinkConfig;
    }

    @GetMapping(value = "/e/{id}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> event(@PathVariable Long id) {
        Event event = eventRepository.findById(id).orElse(null);
        if (event == null) return notFound("event/" + id);
        String where = event.getVenue() != null ? event.getVenue().getName() : null;
        String when = event.getEventDate() != null ? event.getEventDate().format(DATE_FMT) : null;
        String subtitle = join(when, where);
        return html(shareLinkService.renderLandingPage(
                "event/" + id, event.getName(), subtitle, event.getImageUrl()));
    }

    @GetMapping(value = "/a/{id}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> artist(@PathVariable Long id) {
        Artist artist = artistRepository.findById(id).orElse(null);
        if (artist == null) return notFound("artist/" + id);
        return html(shareLinkService.renderLandingPage(
                "artist/" + id, artist.getName(),
                join(artist.getGenre(), "Concertly'de takip et"), artist.getImageUrl()));
    }

    @GetMapping(value = "/u/{username}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> user(@PathVariable String username) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null || !Boolean.TRUE.equals(user.getIsActive())) return notFound("profile");
        String subtitle = ShareLinkService.truncate(
                user.getBio() != null && !user.getBio().isBlank()
                        ? user.getBio()
                        : "Konser pasaportunu Concertly'de gör",
                140);
        return html(shareLinkService.renderLandingPage(
                "user/" + user.getId(), "@" + user.getUsername(), subtitle, user.getProfileImageUrl()));
    }

    @GetMapping(value = "/p/{id}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> post(@PathVariable Long id) {
        Post post = postRepository.findById(id).orElse(null);
        if (post == null) return notFound("post/" + id);
        String author = post.getUser() != null ? "@" + post.getUser().getUsername() : "Concertly";
        return html(shareLinkService.renderLandingPage(
                "post/" + id, author, ShareLinkService.truncate(post.getContent(), 160), post.getImageUrl()));
    }

    @GetMapping(value = "/c/{id}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> community(@PathVariable Long id) {
        Community community = communityRepository.findById(id).orElse(null);
        if (community == null || !"PUBLIC".equals(community.getVisibility())) return notFound("communities");
        return html(shareLinkService.renderLandingPage(
                "community/" + id, community.getName(),
                ShareLinkService.truncate(community.getDescription(), 160), null));
    }

    /**
     * iOS universal link doğrulaması. Team ID + bundle id yoksa (Apple Developer
     * hesabı henüz açılmadıysa) boş liste döner; link o zaman özel şema ile çalışır.
     */
    @GetMapping(value = "/.well-known/apple-app-site-association", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> appleAppSiteAssociation() {
        String appId = shareLinkConfig.getIosAppId();
        List<Map<String, Object>> details = appId == null || appId.isBlank()
                ? List.of()
                : List.of(Map.of(
                        "appID", appId + "." + shareLinkConfig.getIosBundleId(),
                        "paths", List.of("/e/*", "/a/*", "/u/*", "/p/*", "/c/*")));
        return Map.of("applinks", Map.of("apps", List.of(), "details", details));
    }

    /** Android App Links doğrulaması (SHA256 parmak izi EAS credentials'tan gelir). */
    @GetMapping(value = "/.well-known/assetlinks.json", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<Map<String, Object>> assetLinks() {
        return List.of(Map.of(
                "relation", List.of("delegate_permission/common.handle_all_urls"),
                "target", Map.of(
                        "namespace", "android_app",
                        "package_name", shareLinkConfig.getAndroidPackage(),
                        "sha256_cert_fingerprints", List.of())));
    }

    // ── Yardımcılar ──────────────────────────────────────────────────────────

    private ResponseEntity<String> html(String body) {
        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(body);
    }

    /** İçerik silinmişse yine de uygulamayı açmayı dene — kullanıcı boş sayfada kalmasın. */
    private ResponseEntity<String> notFound(String deepPath) {
        return ResponseEntity.status(404).contentType(MediaType.TEXT_HTML).body(
                shareLinkService.renderLandingPage(deepPath, "Concertly",
                        "Bu içerik artık yok — uygulamada başkalarını keşfet.", null));
    }

    private String join(String a, String b) {
        if (a == null || a.isBlank()) return b == null ? "" : b;
        if (b == null || b.isBlank()) return a;
        return a + " · " + b;
    }
}
