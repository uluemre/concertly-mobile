package com.concertly.backend.service;

import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Artist;
import com.concertly.backend.model.Venue;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.SearchText;
import com.concertly.backend.repository.VenueRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Admin içerik yönetimi: sanatçı ve mekân bilgisini düzeltme, tüm toplulukları listeleme.
 *
 * Kurallar:
 * - Elle konan sanatçı fotoğrafı image_source = ADMIN ile kilitlenir; gece görevleri dokunmaz.
 *   Fotoğraf sıfırlanırsa kilit kalkar ve otomatik arama yeniden başlar.
 * - Düzenlenen mekân admin_edited ile işaretlenir; senkron yalnız boş alanları doldurur.
 * - Ad (mekânda ad ya da şehir) değişince eski ad gizli bir yönlendirme kaydı olarak kalır
 *   (merged_into → düzenlenen kayıt). Bilet siteleri eski adla geldiğinde yeni kopya açılmaz,
 *   etkinlik düzenlenen kayda bağlanır. Aynı mantık mükerrer birleştirmede de kullanılıyor.
 */
@Service
public class AdminContentService {

    private static final int PAGE_SIZE = 30;
    private static final Pattern UPLOAD_PATH = Pattern.compile("^/uploads/[A-Za-z0-9._-]+$");
    private static final String FOLD_SQL = "lower(translate(%s, '" + SearchText.FOLD_FROM + "', '" + SearchText.FOLD_TO + "'))";

    private final ArtistRepository artistRepository;
    private final VenueRepository venueRepository;
    private final JdbcTemplate jdbc;

    public AdminContentService(ArtistRepository artistRepository, VenueRepository venueRepository, JdbcTemplate jdbc) {
        this.artistRepository = artistRepository;
        this.venueRepository = venueRepository;
        this.jdbc = jdbc;
    }

    // ── Sanatçılar ────────────────────────────────────────────────────────────

    /** Yaklaşan konseri ve takipçisi çok olanlar önce; q verilirse ada göre (Türkçe harf duyarsız). */
    public List<Map<String, Object>> listArtists(String q, int page) {
        List<Object> args = new ArrayList<>();
        String where = "a.merged_into_artist_id IS NULL";
        if (q != null && !q.isBlank()) {
            where += " AND " + FOLD_SQL.formatted("a.name") + " LIKE ? ESCAPE '!'";
            args.add(SearchText.containsPattern(q.trim()));
        }
        args.add(PAGE_SIZE);
        args.add(Math.max(page, 0) * PAGE_SIZE);
        return jdbc.queryForList("""
                SELECT a.id, a.name, a.genre, a.image_url AS "imageUrl", a.image_source AS "imageSource",
                       a.spotify_id AS "spotifyId",
                       (SELECT count(*) FROM artist_follows f WHERE f.artist_id = a.id) AS followers,
                       (SELECT count(*) FROM events e WHERE e.artist_id = a.id AND e.event_date > now()
                          AND e.is_approved AND e.delisted_reason IS NULL AND e.merged_into_event_id IS NULL) AS upcoming
                FROM artists a
                WHERE %s
                ORDER BY upcoming DESC, followers DESC, a.name ASC
                LIMIT ? OFFSET ?
                """.formatted(where), args.toArray());
    }

    public Map<String, Object> getArtist(Long id) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT a.id, a.name, a.genre, a.genre_tags AS "genreTags", a.image_url AS "imageUrl",
                       a.image_source AS "imageSource", a.spotify_id AS "spotifyId", a.popularity,
                       a.spotify_followers AS "spotifyFollowers", a.merged_into_artist_id AS "mergedInto",
                       (SELECT count(*) FROM artist_follows f WHERE f.artist_id = a.id) AS followers,
                       (SELECT count(*) FROM events e WHERE e.artist_id = a.id AND e.event_date > now()
                          AND e.is_approved AND e.delisted_reason IS NULL AND e.merged_into_event_id IS NULL) AS upcoming,
                       (SELECT count(*) FROM events e WHERE e.artist_id = a.id AND e.event_date <= now()) AS past
                FROM artists a WHERE a.id = ?
                """, id);
        if (rows.isEmpty()) throw new ResourceNotFoundException("ARTIST_NOT_FOUND");
        return rows.get(0);
    }

    /**
     * Gövde alanları isteğe bağlı: gelmeyen değişmez. imageUrl "" ise fotoğraf sıfırlanır
     * (otomatik arama yeniden devreye girer). Dönen liste işlem kaydı içindir.
     */
    @Transactional
    public List<String> updateArtist(Long id, Map<String, Object> body) {
        Artist a = artistRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("ARTIST_NOT_FOUND"));
        if (a.getMergedIntoArtistId() != null) throw new IllegalArgumentException("ARTIST_MERGED");
        List<String> diff = new ArrayList<>();

        if (body.containsKey("name")) {
            String name = text(body.get("name"), 1, 120, "INVALID_NAME");
            if (!name.equals(a.getName())) {
                String oldName = a.getName();
                boolean keyChanged = !SearchText.nameKey(name).equals(SearchText.nameKey(oldName));
                if (keyChanged) {
                    artistRepository.findExisting(null, name)
                            .filter(other -> !other.getId().equals(a.getId()))
                            .ifPresent(other -> { throw new IllegalArgumentException("ARTIST_NAME_TAKEN"); });
                }
                a.setName(name);
                if (keyChanged && oldName != null && !oldName.isBlank()) {
                    Artist alias = new Artist();
                    alias.setName(oldName);
                    alias.setGenre(a.getGenre());
                    alias.setMergedIntoArtistId(a.getId());
                    artistRepository.save(alias);
                }
                diff.add("name: " + oldName + " → " + name);
            }
        }
        if (body.containsKey("genre")) {
            String genre = text(body.get("genre"), 0, 60, "INVALID_GENRE");
            String next = genre.isEmpty() ? null : genre;
            if (!Objects.equals(next, a.getGenre())) {
                diff.add("genre: " + a.getGenre() + " → " + next);
                a.setGenre(next);
            }
        }
        if (body.containsKey("imageUrl")) {
            String url = imageUrl(body.get("imageUrl"));
            if (url == null) {
                if (a.getImageUrl() != null || "ADMIN".equals(a.getImageSource())) {
                    diff.add("image: reset");
                }
                a.setImageUrl(null);
                a.setImageSource(null);
                a.setImageCheckedAt(null);
            } else if (!url.equals(a.getImageUrl()) || !ArtistPhotoService.SOURCE_ADMIN.equals(a.getImageSource())) {
                a.setImageUrl(url);
                a.setImageSource(ArtistPhotoService.SOURCE_ADMIN);
                a.setImageCheckedAt(LocalDateTime.now());
                diff.add("image: " + url);
            }
        }
        artistRepository.save(a);
        return diff;
    }

    // ── Mekânlar ──────────────────────────────────────────────────────────────

    public List<Map<String, Object>> listVenues(String q, String city, int page) {
        List<Object> args = new ArrayList<>();
        String where = "v.merged_into_venue_id IS NULL";
        if (q != null && !q.isBlank()) {
            where += " AND " + FOLD_SQL.formatted("v.name") + " LIKE ? ESCAPE '!'";
            args.add(SearchText.containsPattern(q.trim()));
        }
        if (city != null && !city.isBlank()) {
            where += " AND " + FOLD_SQL.formatted("v.city") + " = ?";
            args.add(SearchText.fold(city.trim()));
        }
        args.add(PAGE_SIZE);
        args.add(Math.max(page, 0) * PAGE_SIZE);
        return jdbc.queryForList("""
                SELECT v.id, v.name, v.city, v.address, v.image_url AS "imageUrl",
                       v.latitude, v.longitude, coalesce(v.admin_edited, false) AS "adminEdited",
                       (SELECT count(*) FROM events e WHERE e.venue_id = v.id AND e.event_date > now()
                          AND e.is_approved AND e.delisted_reason IS NULL AND e.merged_into_event_id IS NULL) AS upcoming
                FROM venues v
                WHERE %s
                ORDER BY upcoming DESC, v.name ASC
                LIMIT ? OFFSET ?
                """.formatted(where), args.toArray());
    }

    public Map<String, Object> getVenue(Long id) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT v.id, v.name, v.city, v.country, v.address, v.image_url AS "imageUrl",
                       v.latitude, v.longitude, coalesce(v.admin_edited, false) AS "adminEdited",
                       v.merged_into_venue_id AS "mergedInto",
                       (SELECT count(*) FROM events e WHERE e.venue_id = v.id AND e.event_date > now()
                          AND e.is_approved AND e.delisted_reason IS NULL AND e.merged_into_event_id IS NULL) AS upcoming,
                       (SELECT count(*) FROM events e WHERE e.venue_id = v.id AND e.event_date <= now()) AS past
                FROM venues v WHERE v.id = ?
                """, id);
        if (rows.isEmpty()) throw new ResourceNotFoundException("VENUE_NOT_FOUND");
        return rows.get(0);
    }

    @Transactional
    public List<String> updateVenue(Long id, Map<String, Object> body) {
        Venue v = venueRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("VENUE_NOT_FOUND"));
        if (v.getMergedIntoVenueId() != null) throw new IllegalArgumentException("VENUE_MERGED");
        List<String> diff = new ArrayList<>();
        String oldName = v.getName();
        String oldCity = v.getCity();

        String name = body.containsKey("name") ? text(body.get("name"), 1, 150, "INVALID_NAME") : oldName;
        String city = body.containsKey("city") ? text(body.get("city"), 1, 60, "INVALID_CITY") : oldCity;
        boolean identityChanged = !Objects.equals(name, oldName) || !Objects.equals(city, oldCity);
        if (identityChanged) {
            venueRepository.findFirstByNameAndCity(name, city)
                    .filter(other -> !other.getId().equals(v.getId()))
                    .ifPresent(other -> { throw new IllegalArgumentException("VENUE_EXISTS"); });
            v.setName(name);
            v.setCity(city);
            if (oldName != null && !oldName.isBlank()) {
                Venue alias = new Venue();
                alias.setName(oldName);
                alias.setCity(oldCity);
                alias.setCountry(v.getCountry());
                alias.setMergedIntoVenueId(v.getId());
                venueRepository.save(alias);
            }
            if (!Objects.equals(name, oldName)) diff.add("name: " + oldName + " → " + name);
            if (!Objects.equals(city, oldCity)) diff.add("city: " + oldCity + " → " + city);
        }
        if (body.containsKey("address")) {
            String address = text(body.get("address"), 0, 255, "INVALID_ADDRESS");
            String next = address.isEmpty() ? null : address;
            if (!Objects.equals(next, v.getAddress())) {
                diff.add("address: " + v.getAddress() + " → " + next);
                v.setAddress(next);
            }
        }
        if (body.containsKey("latitude") || body.containsKey("longitude")) {
            Double lat = coordinate(body.get("latitude"), 90);
            Double lng = coordinate(body.get("longitude"), 180);
            if ((lat == null) != (lng == null)) throw new IllegalArgumentException("INVALID_COORDINATES");
            if (!Objects.equals(lat, v.getLatitude()) || !Objects.equals(lng, v.getLongitude())) {
                diff.add("location: " + v.getLatitude() + "," + v.getLongitude() + " → " + lat + "," + lng);
                v.setLatitude(lat);
                v.setLongitude(lng);
            }
        }
        if (body.containsKey("imageUrl")) {
            String url = imageUrl(body.get("imageUrl"));
            if (!Objects.equals(url, v.getImageUrl())) {
                diff.add("image: " + (url == null ? "reset" : url));
                v.setImageUrl(url);
            }
        }
        if (!diff.isEmpty()) v.setAdminEdited(true);
        venueRepository.save(v);
        return diff;
    }

    // ── Topluluklar ───────────────────────────────────────────────────────────

    /** Tüm topluluklar (gizli, reddedilmiş, arşivlenmiş dahil), en yeni önce. */
    public List<Map<String, Object>> listCommunities(String q, int page) {
        List<Object> args = new ArrayList<>();
        String where = "TRUE";
        if (q != null && !q.isBlank()) {
            where = FOLD_SQL.formatted("c.name") + " LIKE ? ESCAPE '!'";
            args.add(SearchText.containsPattern(q.trim()));
        }
        args.add(PAGE_SIZE);
        args.add(Math.max(page, 0) * PAGE_SIZE);
        return jdbc.queryForList("""
                SELECT c.id, c.name, c.emoji, c.city, c.visibility, c.approval_status AS "approvalStatus",
                       c.archived_at AS "archivedAt", c.created_at AS "createdAt",
                       u.id AS "ownerId", u.username AS "ownerUsername",
                       (SELECT count(*) FROM community_members m WHERE m.community_id = c.id AND m.status = 'ACTIVE') AS members,
                       (SELECT count(*) FROM community_posts p WHERE p.community_id = c.id) AS posts
                FROM communities c LEFT JOIN users u ON u.id = c.owner_id
                WHERE %s
                ORDER BY c.created_at DESC NULLS LAST, c.id DESC
                LIMIT ? OFFSET ?
                """.formatted(where), args.toArray());
    }

    // ── Doğrulama ─────────────────────────────────────────────────────────────

    static String text(Object raw, int min, int max, String error) {
        String s = raw == null ? "" : String.valueOf(raw).trim().replaceAll("\\s+", " ");
        if (s.length() < min || s.length() > max) throw new IllegalArgumentException(error);
        return s;
    }

    /** null/"" = sıfırla. Yalnız kendi yüklememiz (/uploads/...) ya da https bağlantısı. */
    static String imageUrl(Object raw) {
        String s = raw == null ? "" : String.valueOf(raw).trim();
        if (s.isEmpty()) return null;
        if (s.length() > 500) throw new IllegalArgumentException("INVALID_IMAGE_URL");
        if (UPLOAD_PATH.matcher(s).matches()) return s;
        if (s.startsWith("https://") && !s.contains(" ")) return s;
        throw new IllegalArgumentException("INVALID_IMAGE_URL");
    }

    static Double coordinate(Object raw, double limit) {
        if (raw == null || String.valueOf(raw).isBlank()) return null;
        double d;
        try {
            d = Double.parseDouble(String.valueOf(raw).trim().replace(',', '.'));
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("INVALID_COORDINATES");
        }
        if (Double.isNaN(d) || Math.abs(d) > limit) throw new IllegalArgumentException("INVALID_COORDINATES");
        return d;
    }
}
