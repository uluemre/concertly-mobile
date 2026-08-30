package com.concertly.backend.service;

import com.concertly.backend.model.*;
import com.concertly.backend.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;
import java.util.Optional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class TicketmasterService {

    @Value("${ticketmaster.api.key}")
    private String apiKey;

    private final EventRepository eventRepository;
    private final ArtistRepository artistRepository;
    private final VenueRepository venueRepository;
    private final SpotifyService spotifyService;
    private final DeezerService deezerService;
    private final com.concertly.backend.repository.ArtistFollowRepository artistFollowRepository;
    private final NotificationService notificationService;
    private final RestTemplate restTemplate;

    public TicketmasterService(EventRepository eventRepository,
            ArtistRepository artistRepository,
            VenueRepository venueRepository,
            SpotifyService spotifyService,
            DeezerService deezerService,
            com.concertly.backend.repository.ArtistFollowRepository artistFollowRepository,
            NotificationService notificationService) {
        this.eventRepository = eventRepository;
        this.artistRepository = artistRepository;
        this.venueRepository = venueRepository;
        this.spotifyService = spotifyService;
        this.deezerService = deezerService;
        this.artistFollowRepository = artistFollowRepository;
        this.notificationService = notificationService;
        this.restTemplate = new RestTemplate();
    }

    /**
     * Her sabah 06:00'da yeni etkinlikleri otomatik çeker (cron override
     * edilebilir).
     */
    @org.springframework.scheduling.annotation.Scheduled(cron = "${ticketmaster.sync.cron:0 0 6 * * *}")
    public void scheduledSync() {
        System.out.println("⏰ Günlük Ticketmaster senkronizasyonu başlıyor...");
        try {
            syncTurkeyEvents();
        } catch (Exception e) {
            System.out.println("⚠️ Zamanlanmış sync hatası: " + e.getMessage());
        }
    }

    public int syncTurkeyEvents() {
        int total = 0;

        String nowIso = LocalDateTime.now()
                .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'"));

        // Türkiye'deki tüm etkinlikleri Ticketmaster'dan çek
        total += syncFromApi(
                "https://app.ticketmaster.com/discovery/v2/events.json",
                Map.of(
                        "countryCode", "TR",
                        "sort", "date,asc",
                        "size", "100",
                        "startDateTime", nowIso));

        System.out.println(
                "✅ Ticketmaster veri çekme tamamlandı! Toplam: " + total);

        return total;
    }

    /**
     * Türkiye'nin büyük şehirlerindeki en popüler canlı performans mekanları ve
     * sanatçıları için
     * dinamik tarihli (tamamı yaklaşan) konser kataloğu ekler.
     */
    public int syncTurkeyConcertCatalog() {
        int added = 0;

        // --- İSTANBUL ---
        added += addCatalogEvent("Duman - İstanbul Konseri",
                "Duman en sevilen şarkılarıyla KüçükÇiftlik Park sahnesinde!", 3, 21, 0, "Duman", "Rock",
                "KüçükÇiftlik Park", "İstanbul", "Harbiye Mah. Demokrasi Parkı İçi, Şişli", 41.0450, 28.9900,
                "https://www.biletix.com");
        added += addCatalogEvent("Mor ve Ötesi - Volkswagen Arena",
                "Unutulmaz bir rock akşamı, canlı akustik ve senfonik tatlar.", 5, 21, 0, "Mor ve Ötesi", "Rock",
                "Volkswagen Arena", "İstanbul", "Maslak Mah. Taşyoncası Sok., Sarıyer", 41.1120, 29.0050,
                "https://www.passo.com.tr");
        added += addCatalogEvent("Teoman - Harbiye Açıkhava Konserleri",
                "Teoman koyu tonlu klasikleri ve en yenileriyle sahnede.", 7, 21, 0, "Teoman", "Rock",
                "Harbiye Cemil Topuzlu Açıkhava Tiyatrosu", "İstanbul", "Harbiye Mah. Taşkışla Cad., Şişli", 41.0463,
                28.9892, "https://www.biletix.com");
        added += addCatalogEvent("Zeynep Bastık Live", "Yaz canlılığıyla dolu Pop ve akustik hitler.", 9, 20, 30,
                "Zeynep Bastık", "Pop", "Zorlu PSM Turkcell Sahnesi", "İstanbul", "Levazım Mah. Koru Sok., Beşiktaş",
                41.0636, 29.0091, "https://www.passo.com.tr");
        added += addCatalogEvent("Melike Şahin - Solo Konser", "Gönüllerde taht kuran duygusal ve güçlü vokaller.", 11,
                21, 0, "Melike Şahin", "Pop", "Harbiye Cemil Topuzlu Açıkhava Tiyatrosu", "İstanbul",
                "Harbiye Mah. Taşkışla Cad., Şişli", 41.0463, 28.9892, "https://www.biletix.com");
        added += addCatalogEvent("Mabel Matiz - Maya Turnesi", "Mabel Matiz rengarenk sahne şovu ve şarkılarıyla.", 13,
                21, 0, "Mabel Matiz", "Pop", "Zorlu PSM Turkcell Sahnesi", "İstanbul",
                "Levazım Mah. Koru Sok., Beşiktaş", 41.0636, 29.0091, "https://www.passo.com.tr");
        added += addCatalogEvent("Madrigal - Vadistanbul Konseri", "Sen de O Zaman, Dip ve diğer indie hitler.", 15, 22,
                0, "Madrigal", "Indie", "Jolly Joker Vadistanbul", "İstanbul", "Ayazağa Mah. Cendere Cad., Sarıyer",
                41.1070, 28.9900, "https://www.biletix.com");
        added += addCatalogEvent("Yüzyüzeyken Konuşuruz", "Kadıköy sahnesinde alternatif rock rüzgarı.", 17, 21, 30,
                "Yüzyüzeyken Konuşuruz", "Indie", "Dorock XL Kadıköy", "İstanbul", "Caferağa Mah. Moda Cad., Kadıköy",
                40.9880, 29.0250, "https://www.bubilet.com.tr");
        added += addCatalogEvent("Dolu Kadehi Ters Tut", "Enerjisi yüksek indie pop ritimleri.", 19, 21, 0,
                "Dolu Kadehi Ters Tut", "Indie", "Babylon Bomonti", "İstanbul", "Merkez Mah. Silahşör Cad., Şişli",
                41.0570, 28.9810, "https://www.biletix.com");
        added += addCatalogEvent("Pinhani - KüçükÇiftlik Açık Hava",
                "Beni Sen İnandır, Dön Bak Dünyaya ve tüm Pinhani klasikleri.", 21, 20, 30, "Pinhani", "Rock",
                "KüçükÇiftlik Park", "İstanbul", "Harbiye Mah., Şişli", 41.0450, 28.9900, "https://www.biletix.com");
        added += addCatalogEvent("Sertab Erener - Pop Symphony", "Eurovision şampiyonundan görkemli sahne şovu.", 23,
                21, 0, "Sertab Erener", "Pop", "Harbiye Cemil Topuzlu Açıkhava Tiyatrosu", "İstanbul",
                "Harbiye Mah., Şişli", 41.0463, 28.9892, "https://www.passo.com.tr");
        added += addCatalogEvent("Kenan Doğulu - Yaz Konserleri", "Festival tadında dans, pop ve şov partisi.", 25, 21,
                30, "Kenan Doğulu", "Pop", "Volkswagen Arena", "İstanbul", "Maslak Mah., Sarıyer", 41.1120, 29.0050,
                "https://www.biletix.com");
        added += addCatalogEvent("Edis Live Performance", "Martılar, Arıyorum ve ritmik Edis hitleri.", 27, 21, 0,
                "Edis", "Pop", "KüçükÇiftlik Park", "İstanbul", "Harbiye Mah., Şişli", 41.0450, 28.9900,
                "https://www.passo.com.tr");
        added += addCatalogEvent("Adamlar - Kadıköy Gece", "Koca Yaşlı Şişko Dünya ve sıra dışı rock performanslar.",
                29, 22, 0, "Adamlar", "Rock", "Dorock XL Kadıköy", "İstanbul", "Caferağa Mah., Kadıköy", 40.9880,
                29.0250, "https://www.bubilet.com.tr");
        added += addCatalogEvent("Ceza - Maslak Hip-Hop Gece", "Türkçe Rap'in efsanevi üstadı sahnede.", 31, 21, 0,
                "Ceza", "Rap", "Volkswagen Arena", "İstanbul", "Maslak Mah., Sarıyer", 41.1120, 29.0050,
                "https://www.biletix.com");

        // --- ANKARA ---
        added += addCatalogEvent("Manga Live in Ankara", "Eurovision ikincisi Manga en sevilen şarkılarıyla KKM'de.", 4,
                20, 30, "Manga", "Rock", "ODTÜ KKM", "Ankara", "Üniversiteler Mah., Çankaya", 39.8870, 32.7690,
                "https://www.biletix.com");
        added += addCatalogEvent("Athena - Akustik & Elektrik", "Holigan, Skalizm ve unutulmaz Ska Rock coşkusu.", 6,
                21, 0, "Athena", "Rock", "IF Performance Hall", "Ankara", "Kavaklıdere Mah. Tunus Cad., Çankaya",
                39.9055, 32.8597, "https://www.bubilet.com.tr");
        added += addCatalogEvent("Göksel - Jolly Joker Ankara",
                "Depresyon Oteli, Sen Orda Yoktun ve unutulmaz nostalji hitler.", 8, 22, 0, "Göksel", "Pop",
                "Jolly Joker Ankara", "Ankara", "Kavaklıdere Mah. Kızılırmak Cad., Çankaya", 39.9070, 32.8580,
                "https://www.biletix.com");
        added += addCatalogEvent("Yalın - Unutulmaz Şarkılar", "Zalim, Keyfi Yolunda ve Aşk Senfonisi.", 10, 20, 30,
                "Yalın", "Pop", "CSO Ada Ankara", "Ankara", "Talatpaşa Bulvarı, Altındağ", 39.9320, 32.8530,
                "https://www.biletix.com");
        added += addCatalogEvent("Fazıl Say - Piyano Resitali", "Dünyaca ünlü piyanistimizden başyapıtlar.", 12, 20, 0,
                "Fazıl Say", "Klasik", "CSO Ada Ankara", "Ankara", "Talatpaşa Bulvarı, Altındağ", 39.9320, 32.8530,
                "https://www.biletinial.com");
        added += addCatalogEvent("Ezhel - Ankara Dönüşü", "Geceler, Felaket ve Ankara getto tınıları.", 14, 22, 0,
                "Ezhel", "Rap", "IF Performance Hall", "Ankara", "Kavaklıdere Mah., Çankaya", 39.9055, 32.8597,
                "https://www.biletix.com");
        added += addCatalogEvent("Semicenk - Ankara Gece", "Son dönemin rekortmen sesinden en çok dinlenen hitler.", 16,
                22, 0, "Semicenk", "Pop", "Jolly Joker Ankara", "Ankara", "Kavaklıdere Mah., Çankaya", 39.9070, 32.8580,
                "https://www.bubilet.com.tr");

        // --- İZMİR ---
        added += addCatalogEvent("Duman - Alsancak Konseri", "İzmir Körfez esintisinde Duman açık hava deneyimi.", 5,
                21, 0, "Duman", "Rock", "Tarihi Havagazı Fabrikası", "İzmir", "Umurbey Mah. Liman Cad., Konak", 38.4378,
                27.1500, "https://www.biletix.com");
        added += addCatalogEvent("Mor ve Ötesi - Mavişehir", "Bir Derdim Var, Cambaz ve rock klasikleri.", 8, 21, 0,
                "Mor ve Ötesi", "Rock", "SoldOut Performance Hall", "İzmir", "Mavişehir Mah., Karşıyaka", 38.4850,
                27.0890, "https://www.bubilet.com.tr");
        added += addCatalogEvent("Mabel Matiz - İzmir Arena", "İzmir izleyicisine özel görkemli sahne şovu.", 12, 21, 0,
                "Mabel Matiz", "Pop", "Tarihi Havagazı Fabrikası", "İzmir", "Umurbey Mah., Konak", 38.4378, 27.1500,
                "https://www.passo.com.tr");
        added += addCatalogEvent("Zeynep Bastık - Alaçatı Yazı", "Çeşme yaz gecesinde canlı pop performansı.", 15, 22,
                30, "Zeynep Bastık", "Pop", "Jolly Joker Alaçatı", "İzmir", "Alaçatı Mah., Çeşme", 38.2830, 26.3750,
                "https://www.biletix.com");
        added += addCatalogEvent("Teoman - Alsancak Akustik", "Paramparça, İki Yabancı ve klasikleşen melodiler.", 18,
                21, 0, "Teoman", "Rock", "Tarihi Havagazı Fabrikası", "İzmir", "Umurbey Mah., Konak", 38.4378, 27.1500,
                "https://www.bubilet.com.tr");

        // --- ANTALYA ---
        added += addCatalogEvent("Melike Şahin - Antalya Açıkhava", "Akdeniz gecesinde büyüleyici vokaller.", 6, 21, 0,
                "Melike Şahin", "Pop", "Antalya Açıkhava Tiyatrosu", "Antalya", "Meltem Mah., Muratpaşa", 36.8820,
                30.6950, "https://www.biletix.com");
        added += addCatalogEvent("Ceza - Kaleiçi Hip-Hop", "Kaleiçi Holly Stone sahnesinde rap fırtınası.", 9, 22, 0,
                "Ceza", "Rap", "Holly Stone Performance Hall", "Antalya", "Selçuk Mah. Uzun Çarşı Sok., Kaleiçi",
                36.8850, 30.7050, "https://www.bubilet.com.tr");
        added += addCatalogEvent("Edis - Jolly Joker Antalya",
                "Antalya canlı müzik gecelerinde sürprizlerle dolu pop sahnesi.", 13, 22, 0, "Edis", "Pop",
                "Jolly Joker Antalya", "Antalya", "Fener Mah. Bülent Ecevit Bulvarı, Muratpaşa", 36.8770, 30.7180,
                "https://www.biletix.com");
        added += addCatalogEvent("Madrigal - Antalya Konseri", "Antalya Açıkhava'da romantik alternatif pop ritimleri.",
                17, 21, 0, "Madrigal", "Indie", "Antalya Açıkhava Tiyatrosu", "Antalya", "Meltem Mah., Muratpaşa",
                36.8820, 30.6950, "https://www.passo.com.tr");

        // --- BURSA ---
        added += addCatalogEvent("Mor ve Ötesi - Bursa Açıkhava",
                "Bursa Kültürpark Açıkhava tiyatrosunda coşkulu konser.", 7, 21, 0, "Mor ve Ötesi", "Rock",
                "Bursa Kültür Park Açıkhava", "Bursa", "Gaziakdemir Mah., Osmangazi", 40.1920, 29.0450,
                "https://www.biletix.com");
        added += addCatalogEvent("Duman - Nilüfer Gece", "Nilüfer sahnelerinde Duman rüzgarı.", 10, 21, 30, "Duman",
                "Rock", "Jolly Joker Bursa", "Bursa", "Odunluk Mah. Akpınar Cad., Nilüfer", 40.2180, 28.9750,
                "https://www.bubilet.com.tr");

        // --- ESKİŞEHİR ---
        added += addCatalogEvent("Teoman - Eskişehir IF", "Üniversite kenti Eskişehir'de unutulmaz rock gecesi.", 6, 21,
                30, "Teoman", "Rock", "IF Performance Hall Eskişehir", "Eskişehir",
                "Hoşnudiye Mah. İsmet İnönü Cad., Tepebaşı", 39.7820, 30.5120, "https://www.biletix.com");
        added += addCatalogEvent("Adamlar - Eskişehir Gece",
                "Jolly Joker Eskişehir sahnesinde sıra dışı canlı performans.", 11, 22, 0, "Adamlar", "Rock",
                "Jolly Joker Eskişehir", "Eskişehir", "Hoşnudiye Mah., Tepebaşı", 39.7850, 30.5150,
                "https://www.bubilet.com.tr");

        // --- MUĞLA / BODRUM ---
        added += addCatalogEvent("Kenan Doğulu - Bodrum Antik Tiyatro",
                "Ege denizinin kıyısında, tarihi Antik Tiyatro atmosferinde pop şöleni.", 14, 21, 15, "Kenan Doğulu",
                "Pop", "Bodrum Antik Tiyatro", "Muğla", "Yeniköy Mah. Kıbrıs Şehitleri Cad., Bodrum", 37.0380, 27.4230,
                "https://www.biletix.com");
        added += addCatalogEvent("Zeynep Bastık - Bodrum Konserleri",
                "Bodrum yaz ritimleri ve en popüler cover parçalar.", 19, 21, 15, "Zeynep Bastık", "Pop",
                "Bodrum Antik Tiyatro", "Muğla", "Yeniköy Mah., Bodrum", 37.0380, 27.4230, "https://www.passo.com.tr");

        // --- ADANA ---
        added += addCatalogEvent("Gazapizm - Adana Açıkhava", "Unutulmaz rap hitleri ve senfonik orkestra eşliği.", 15,
                21, 0, "Gazapizm", "Rap", "Adana Çukurova Açıkhava", "Adana", "Güzelyalı Mah., Çukurova", 37.0450,
                35.3120, "https://www.biletix.com");

        return added;
    }

    private int addCatalogEvent(String name, String description, int daysFromNow, int hour, int minute,
            String artistName, String genre, String venueName, String city,
            String address, double lat, double lng, String ticketUrl) {
        try {
            LocalDateTime date = LocalDateTime.now().plusDays(daysFromNow).withHour(hour).withMinute(minute)
                    .withSecond(0).withNano(0);
            String extId = "catalog_" + city.toLowerCase() + "_" + artistName.toLowerCase().replaceAll("[^a-z0-9]", "")
                    + "_" + daysFromNow;

            if (eventRepository.findByExternalId(extId).isPresent()) {
                return 0;
            }

            Artist artist = artistRepository.findFirstByNameIgnoreCase(artistName).orElseGet(() -> {
                Artist a = new Artist();
                a.setName(artistName);
                a.setGenre(genre);
                a.setExternalId("art_" + artistName.toLowerCase().replaceAll("[^a-z0-9]", ""));
                return artistRepository.save(a);
            });

            Venue venue = venueRepository.findFirstByNameAndCity(venueName, city).orElseGet(() -> {
                Venue v = new Venue();
                v.setName(venueName);
                v.setCity(city);
                v.setCountry("Türkiye");
                v.setAddress(address);
                v.setLatitude(lat);
                v.setLongitude(lng);
                v.setExternalId(
                        "ven_" + venueName.toLowerCase().replaceAll("[^a-z0-9]", "") + "_" + city.toLowerCase());
                return venueRepository.save(v);
            });

            Event event = new Event();
            event.setName(name);
            event.setDescription(description);
            event.setEventDate(date);
            event.setExternalId(extId);
            event.setIsApproved(true);
            event.setArtist(artist);
            event.setVenue(venue);
            event.setTicketUrl(ticketUrl);
            event.setGenre(genre);
            if (!isBlank(artist.getImageUrl())) {
                event.setImageUrl(artist.getImageUrl());
            }

            eventRepository.save(event);
            return 1;
        } catch (Exception e) {
            System.out.println("⚠️ Katalog etkinlik ekleme uyarısı (" + name + "): " + e.getMessage());
            return 0;
        }
    }

    /**
     * Aynı mekân + aynı tarih/saatteki mükerrer etkinlikleri temizler. Her gruptan
     * görseli olan + en eski kaydı tutar, fazlalıkları siler. Katılım/post/review
     * gibi
     * kullanıcı verisi olan kayıt FK hatası verir → try/catch ile korunur
     * (silinmez).
     */
    public int removeDuplicateEvents() {
        Map<String, List<Event>> groups = new LinkedHashMap<>();
        for (Event e : eventRepository.findAll()) {
            if (e.getVenue() == null || e.getVenue().getId() == null
                    || e.getVenue().getExternalId() == null || e.getEventDate() == null)
                continue;
            String key = e.getVenue().getId() + "|" + e.getEventDate();
            groups.computeIfAbsent(key, k -> new ArrayList<>()).add(e);
        }

        int removed = 0;
        for (List<Event> group : groups.values()) {
            if (group.size() < 2)
                continue;
            // Korunacak: görseli olan öne, sonra en küçük id (en eski)
            group.sort(Comparator
                    .comparingInt((Event e) -> isBlank(e.getImageUrl()) ? 1 : 0)
                    .thenComparing(Event::getId));
            for (int i = 1; i < group.size(); i++) {
                // Native conditional delete is atomic. Unlike delete()+catch, it
                // cannot defer the FK error until a later JPA flush.
                removed += eventRepository.deleteIfUnreferenced(group.get(i).getId());
            }
        }

        if (removed > 0)
            System.out.println("🧹 " + removed + " mükerrer etkinlik temizlendi.");
        return removed;
    }

    @SuppressWarnings("unchecked")
    private int syncFromApi(String baseUrl, Map<String, Object> baseParams) {
        if (isBlank(apiKey) || apiKey.contains("change") || apiKey.contains("default")
                || apiKey.equals("your_api_key")) {
            System.out.println("❌ Ticketmaster API key bulunamadı.");
            return 0;
        }

        int count = 0;
        int page = 0;

        try {
            while (true) {

                UriComponentsBuilder builder = UriComponentsBuilder
                        .fromUriString(baseUrl)
                        .queryParam("apikey", apiKey)
                        .queryParam("page", page);

                for (var entry : baseParams.entrySet()) {
                    builder.queryParam(entry.getKey(), entry.getValue());
                }

                String url = builder.toUriString();

                Map<String, Object> response = restTemplate.getForObject(url, Map.class);

                if (response == null) {
                    break;
                }

                Map<String, Object> embedded = (Map<String, Object>) response.get("_embedded");

                if (embedded == null) {
                    break;
                }

                List<Map<String, Object>> events = (List<Map<String, Object>>) embedded.get("events");

                if (events == null || events.isEmpty()) {
                    break;
                }

                int before = count;

                count += processEvents(events);

                System.out.println(
                        "📄 Sayfa " + page +
                                " | API: " + events.size() +
                                " | Yeni: " + (count - before));

                Map<String, Object> pageInfo = (Map<String, Object>) response.get("page");

                if (pageInfo == null) {
                    break;
                }

                Number totalPagesNumber = (Number) pageInfo.get("totalPages");

                if (totalPagesNumber == null) {
                    break;
                }

                int totalPages = totalPagesNumber.intValue();

                // Ticketmaster'da 1000. kayıttan sonrasına
                // deep paging yapılamaz.
                if (page >= Math.min(totalPages, 5) - 1) {
                    break;
                }

                page++;

                // API'yi gereksiz yere zorlamamak için
                // kısa bekleme.
                Thread.sleep(250);
            }

        } catch (Exception ex) {
            String msg = ex.getMessage();

            if (msg != null &&
                    (msg.contains("401")
                            || msg.contains("InvalidApiKey")
                            || msg.contains("Unauthorized"))) {

                System.out.println("❌ Ticketmaster API key geçersiz.");

            } else {
                System.out.println(
                        "⚠️ Sync hatası (" + baseParams + "): " + msg);
            }
        }

        return count;
    }

    @SuppressWarnings("unchecked")
    private int processEvents(List<Map<String, Object>> events) {
        int count = 0;

        for (Map<String, Object> e : events) {
            try {
                String externalId = (String) e.get("id");

                if (externalId == null) {
                    System.out.println("  ⚠️ Event atlandı: externalId yok");
                    continue;
                }

                // DB'de var mı?
                Optional<Event> existingEvent = eventRepository.findByExternalId(externalId);

                Event event;

                if (existingEvent.isPresent()) {
                    // VARSA GÜNCELLE
                    event = existingEvent.get();
                    System.out.println("  🔄 Event güncelleniyor: " + externalId);
                } else {
                    // YOKSA YENİ OLUŞTUR
                    event = new Event();
                    event.setExternalId(externalId);
                    System.out.println("  🆕 Yeni event: " + externalId);
                }

                String name = (String) e.get("name");

                if (name == null)
                    continue;

                // =========================
                // DATE
                // =========================

                Map<String, Object> dates = (Map<String, Object>) e.get("dates");

                if (dates == null)
                    continue;

                Map<String, Object> start = (Map<String, Object>) dates.get("start");

                if (start == null)
                    continue;

                String dateStr = (String) start.get("localDate");

                if (dateStr == null)
                    continue;

                String timeStr = start.get("localTime") != null
                        ? (String) start.get("localTime")
                        : "20:00:00";

                LocalDateTime eventDate = LocalDateTime.parse(dateStr + "T" + timeStr);

                // Geçmiş etkinlikleri alma
                if (eventDate.isBefore(LocalDateTime.now()))
                    continue;

                // =========================
                // IMAGE
                // =========================

                String eventImageUrl = null;

                List<Map<String, Object>> tmImages = (List<Map<String, Object>>) e.get("images");

                eventImageUrl = extractBestImage(tmImages);

                // =========================
                // TICKET
                // =========================

                String ticketUrl = (String) e.get("url");

                String genre = extractGenre(e);

                // =========================
                // ARTIST
                // =========================

                Map<String, Object> emb = (Map<String, Object>) e.get("_embedded");

                Artist artist = extractOrCreateArtist(emb, externalId, name);

                // =========================
                // VENUE
                // =========================

                Venue venue = extractOrCreateVenue(emb);

                // =========================
                // DESCRIPTION
                // =========================

                String description = (String) e.get("info");

                if (isBlank(description)) {
                    description = (String) e.get("pleaseNote");
                }

                if (isBlank(description)) {
                    description = (String) e.get("description");
                }

                if (isBlank(description)) {
                    description = name + " etkinligi — " +
                            (artist.getName() != null
                                    ? artist.getName()
                                    : "")
                            +
                            " performansi. Biletler satista!";
                }

                // PostgreSQL varchar(255)
                if (description.length() > 255) {
                    description = description.substring(0, 252) + "...";
                }

                // =========================
                // IMAGE FALLBACK
                // =========================

                if (isBlank(eventImageUrl)
                        && !isBlank(artist.getImageUrl())) {

                    eventImageUrl = artist.getImageUrl();
                }

                // =========================
                // EVENT BİLGİLERİ
                // =========================

                event.setName(name);
                event.setDescription(description);
                event.setEventDate(eventDate);
                event.setIsApproved(true);
                event.setArtist(artist);
                event.setVenue(venue);
                event.setImageUrl(eventImageUrl);
                event.setTicketUrl(ticketUrl);

                event.setGenre(
                        genre != null
                                ? genre
                                : artist.getGenre());

                // =========================
                // SAVE
                // =========================

                eventRepository.save(event);

                count++;

                System.out.println(
                        "  ✅ " +
                                (existingEvent.isPresent()
                                        ? "Güncellendi: "
                                        : "Eklendi: ")
                                +
                                name +
                                " | " +
                                artist.getName() +
                                " | " +
                                eventDate.toLocalDate());

                // Turne bildirimi
                if (!existingEvent.isPresent()) {
                    notifyArtistFollowers(event, artist);
                }

            } catch (Exception ex) {

                String msg = ex.getMessage();

                if (msg != null &&
                        (msg.contains("unique")
                                || msg.contains("duplicate")
                                || msg.contains("Unique"))) {

                    System.out.println(
                            "  ⏭️ Event zaten mevcut, atlandı.");

                } else {

                    System.out.println(
                            "  ⚠️ Event parse: " + msg);
                }
            }
        }

        return count;
    }

    /**
     * Yeni etkinlik eklenince sanatçının takipçilerine "turne duyurusu" bildirimi
     * düşer.
     */
    private void notifyArtistFollowers(Event event, Artist artist) {
        try {
            if (artist == null || artist.getId() == null)
                return;
            String city = event.getVenue() != null && event.getVenue().getCity() != null
                    ? " (" + event.getVenue().getCity() + ")"
                    : "";
            String message = artist.getName() + " — " + event.getName() + city;
            artistFollowRepository.findAllByArtistId(artist.getId()).forEach(follow -> notificationService.sendSystem(
                    follow.getUser().getId(), "new_event", "event", event.getId(), message));
        } catch (Exception e) {
            System.out.println("  ⚠️ Takipçi bildirimi hatası: " + e.getMessage());
        }
    }

    private String extractBestImage(List<Map<String, Object>> images) {
        if (images == null || images.isEmpty())
            return null;

        // Telefon kartları için ~640px ideal: 1024-2048'lik varyantlar
        // 3-4 kat fazla bant genişliği harcıyor, görünür fark yok.
        Map<String, Object> best16x9 = null;
        Map<String, Object> bestAny = null;
        int best16x9Width = Integer.MAX_VALUE;
        int bestAnyWidth = 0;

        for (Map<String, Object> img : images) {
            String url = (String) img.get("url");
            if (isBlank(url))
                continue;

            Object w = img.get("width");
            int width = (w instanceof Integer) ? (Integer) w : (w instanceof Number ? ((Number) w).intValue() : 0);
            String ratio = (String) img.get("ratio");
            boolean is16x9 = ratio != null && ratio.contains("16_9");

            // 16:9 + en az 500px olanlardan EN KÜÇÜĞÜNÜ seç (tipik: 640px)
            if (is16x9 && width >= 500 && width < best16x9Width) {
                best16x9Width = width;
                best16x9 = img;
            }
            if (width > bestAnyWidth) {
                bestAnyWidth = width;
                bestAny = img;
            }
        }

        Map<String, Object> chosen = best16x9 != null ? best16x9 : (bestAny != null ? bestAny : images.get(0));
        String url = (String) chosen.get("url");
        return isBlank(url) ? null : url;
    }

    @SuppressWarnings("unchecked")
    private String extractGenre(Map<String, Object> event) {
        try {
            List<Map<String, Object>> classifications = (List<Map<String, Object>>) event.get("classifications");
            if (classifications == null || classifications.isEmpty())
                return null;

            Map<String, Object> cls = classifications.get(0);

            // Try subGenre first (more specific), then genre, then segment
            String[] keys = { "subGenre", "genre", "segment" };
            for (String key : keys) {
                Map<String, Object> g = (Map<String, Object>) cls.get(key);
                if (g != null) {
                    String name = (String) g.get("name");
                    if (name != null && !name.isBlank()) {
                        return mapTmGenre(name);
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private String mapTmGenre(String tmGenre) {
        if (isBlank(tmGenre))
            return null;
        String g = tmGenre.toLowerCase().trim();

        // "Undefined" ve anlamsız değerleri ele
        if (g.equals("undefined") || g.equals("music") || g.equals("other")
                || g.equals("miscellaneous") || g.length() < 3)
            return null;

        if (g.contains("metal") || g.contains("punk") || g.contains("hard rock"))
            return "Rock";
        if (g.contains("rock") || g.contains("alternative") || g.contains("grunge"))
            return "Rock";
        if (g.contains("rap") || g.contains("hip hop") || g.contains("hip-hop") || g.contains("trap"))
            return "Rap";
        if (g.contains("r&b") || g.contains("soul") || g.contains("funk"))
            return "R&B";
        if (g.contains("techno") || g.contains("house") || g.contains("edm") || g.contains("trance")
                || g.contains("electronic") || g.contains("dance") || g.contains("dubstep"))
            return "Elektronik";
        if (g.contains("jazz"))
            return "Jazz";
        if (g.contains("blues"))
            return "Jazz";
        if (g.contains("classical") || g.contains("orchestra") || g.contains("opera"))
            return "Klasik";
        if (g.contains("indie"))
            return "Indie";
        if (g.contains("folk") || g.contains("acoustic") || g.contains("country"))
            return "Folk";
        if (g.contains("reggae") || g.contains("ska"))
            return "Reggae";
        if (g.contains("latin") || g.contains("salsa"))
            return "Latin";
        if (g.contains("pop"))
            return "Pop";
        if (g.contains("world") || g.contains("turk") || g.contains("anadolu"))
            return "Rock";
        return null;
    }

    @SuppressWarnings("unchecked")
    private Artist extractOrCreateArtist(Map<String, Object> emb, String eventExternalId, String eventName) {
        String rawName = eventName;
        String externalId = eventExternalId + "_artist";
        String tmImageUrl = null;
        String tmGenre = null;

        if (emb != null && emb.get("attractions") != null) {
            List<Map<String, Object>> attractions = (List<Map<String, Object>>) emb.get("attractions");
            if (!attractions.isEmpty()) {
                Map<String, Object> attraction = attractions.get(0);
                rawName = (String) attraction.get("name");
                if (attraction.get("id") != null)
                    externalId = (String) attraction.get("id");
                List<Map<String, Object>> attrImages = (List<Map<String, Object>>) attraction.get("images");
                tmImageUrl = extractBestImage(attrImages);
                tmGenre = extractGenre(attraction);
            }
        }

        String artistName = cleanArtistName(rawName);

        // Spotify sync sırasında ÇAĞRILMIYOR — enrichMissingData() yavaş şekilde yapar.
        // Burada Spotify çağrısı rate limit'i mahveder.

        // Find or create artist
        Artist artist = artistRepository.findByExternalId(externalId)
                .orElseGet(() -> artistRepository.findFirstByNameIgnoreCase(artistName)
                        .orElseGet(Artist::new));

        artist.setName(artistName);
        if (artist.getExternalId() == null)
            artist.setExternalId(externalId);

        // TM verilerini sadece eksikse kullan
        if (isBlank(artist.getImageUrl()) && !isBlank(tmImageUrl)) {
            artist.setImageUrl(tmImageUrl);
        }
        if (isBlank(artist.getGenre()) && !isBlank(tmGenre)) {
            artist.setGenre(tmGenre);
        }

        return artistRepository.save(artist);
    }

    @SuppressWarnings("unchecked")
    private Venue extractOrCreateVenue(Map<String, Object> emb) {
        Venue venue = new Venue();

        if (emb != null && emb.get("venues") != null) {
            List<Map<String, Object>> venues = (List<Map<String, Object>>) emb.get("venues");
            if (!venues.isEmpty()) {
                Map<String, Object> v = venues.get(0);

                String venueExternalId = (String) v.get("id");
                if (venueExternalId != null) {
                    venue = venueRepository.findByExternalId(venueExternalId).orElseGet(Venue::new);
                    venue.setExternalId(venueExternalId);
                }

                venue.setName((String) v.get("name"));

                if (v.get("city") != null) {
                    Map<String, Object> cityMap = (Map<String, Object>) v.get("city");
                    venue.setCity((String) cityMap.get("name"));
                }
                if (v.get("country") != null) {
                    Map<String, Object> country = (Map<String, Object>) v.get("country");
                    venue.setCountry((String) country.get("name"));
                } else {
                    venue.setCountry("Türkiye");
                }
                if (v.get("address") != null) {
                    Map<String, Object> addressMap = (Map<String, Object>) v.get("address");
                    venue.setAddress((String) addressMap.get("line1"));
                }
                if (v.get("location") != null) {
                    Map<String, Object> loc = (Map<String, Object>) v.get("location");
                    try {
                        venue.setLatitude(Double.parseDouble((String) loc.get("latitude")));
                        venue.setLongitude(Double.parseDouble((String) loc.get("longitude")));
                    } catch (Exception ignored) {
                    }
                }

                List<Map<String, Object>> venueImages = (List<Map<String, Object>>) v.get("images");
                String venueImageUrl = extractBestImage(venueImages);
                if (venueImageUrl != null && venue.getImageUrl() == null) {
                    venue.setImageUrl(venueImageUrl);
                }

                return venueRepository.save(venue);
            }
        }

        venue.setName("Bilinmiyor");
        venue.setCity("TR");
        venue.setCountry("Türkiye");
        return venueRepository.save(venue);
    }

    public Map<String, Integer> enrichMissingData() {
        AtomicInteger enrichedImages = new AtomicInteger(0);
        AtomicInteger enrichedGenres = new AtomicInteger(0);

        // Sadece görseli veya türü eksik artist'leri sorgula
        List<Artist> allArtists = artistRepository.findAll();
        List<Artist> needsEnrich = allArtists.stream()
                .filter(a -> !isBlank(a.getName()) && (isBlank(a.getImageUrl()) ||
                        (a.getImageUrl() != null && a.getImageUrl().contains("s1.ticketm.net")) ||
                        isBlank(a.getGenre())))
                .collect(java.util.stream.Collectors.toList());

        System.out.println("🎤 " + needsEnrich.size() + "/" + allArtists.size() + " artist Spotify'dan çekilecek...");

        int idx = 0;
        for (Artist artist : needsEnrich) {
            idx++;
            System.out.print("  [" + idx + "/" + needsEnrich.size() + "] " + artist.getName() + " → ");
            boolean changed = false;

            // Görsel: Deezer (API key yok, rate limit yok)
            boolean needsImage = isBlank(artist.getImageUrl()) || !isSpotifyImage(artist.getImageUrl());
            if (needsImage) {
                DeezerService.DeezerArtistData dd = deezerService.searchArtist(artist.getName());
                if (dd != null && dd.imageUrl != null) {
                    artist.setImageUrl(dd.imageUrl);
                    changed = true;
                    System.out.print("görsel✓ ");
                } else {
                    System.out.print("görsel✗ ");
                }
            } else {
                System.out.print("görsel-mevcut ");
            }

            // Tür: Spotify (rate limit varsa null döner, mevcut genre korunur)
            if (isBlank(artist.getGenre())) {
                SpotifyService.SpotifyArtistData sd = spotifyService.searchArtist(artist.getName());
                if (sd != null && sd.genre != null) {
                    artist.setGenre(sd.genre);
                    changed = true;
                    System.out.print("tür✓");
                } else {
                    System.out.print("tür✗");
                }
                try {
                    Thread.sleep(500);
                } catch (InterruptedException ignored) {
                }
            } else {
                System.out.print("tür-mevcut");
            }

            System.out.println();
            if (changed)
                artistRepository.save(artist);
        }

        // Event'leri artist verisine göre güncelle
        List<Event> events = eventRepository.findAll();
        for (Event event : events) {
            Artist artist = event.getArtist();
            if (artist == null)
                continue;
            boolean changed = false;

            // TM görselini Spotify artist görseli ile değiştir
            if (!isBlank(artist.getImageUrl()) && isSpotifyImage(artist.getImageUrl())) {
                boolean needsImageUpdate = isBlank(event.getImageUrl()) || !isSpotifyImage(event.getImageUrl());
                if (needsImageUpdate) {
                    event.setImageUrl(artist.getImageUrl());
                    enrichedImages.incrementAndGet();
                    changed = true;
                }
            }

            // Türü güncelle — artist'te Spotify verisi varsa event'i de güncelle
            if (!isBlank(artist.getGenre())) {
                event.setGenre(artist.getGenre());
                enrichedGenres.incrementAndGet();
                changed = true;
            }

            if (changed)
                eventRepository.save(event);
        }

        System.out.println("✅ Enrichment tamamlandı — görsel: " + enrichedImages + ", tür: " + enrichedGenres);
        return Map.of("enrichedImages", enrichedImages.get(), "enrichedGenres", enrichedGenres.get(),
                "artists", allArtists.size(), "events", events.size());
    }

    private String cleanArtistName(String rawName) {
        if (rawName == null)
            return "Bilinmeyen Sanatci";
        return rawName.replaceAll("(?i)\\s*( - | \\(| \\| |Konseri|Live|Tour|Turnesi|Festivali).*", "").trim();
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    // Deezer veya Spotify CDN → kaliteli görsel
    private boolean isSpotifyImage(String url) {
        return url != null && (url.contains("scdn.co") || url.contains("cdns-images.dzcdn.net"));
    }
}
