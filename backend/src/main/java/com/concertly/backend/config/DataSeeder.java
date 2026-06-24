package com.concertly.backend.config;

import com.concertly.backend.model.Artist;
import com.concertly.backend.model.Community;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.CommunityRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataSeeder implements CommandLineRunner {

    private final CommunityRepository communityRepository;
    private final ArtistRepository artistRepository;

    public DataSeeder(CommunityRepository communityRepository,
                      ArtistRepository artistRepository) {
        this.communityRepository = communityRepository;
        this.artistRepository = artistRepository;
    }

    @Override
    public void run(String... args) {
        seedCommunities();
        backfillCommunityDefaults();
        seedArtists();
    }

    // Görünürlük/onay kolonları sonradan eklendi → eski (seed/mevcut) kayıtlarda null kalanları
    // güvenli varsayılanlara çek: hepsi herkese açık + onaylı sayılır.
    private void backfillCommunityDefaults() {
        var legacy = communityRepository.findByApprovalStatusIsNullOrVisibilityIsNull();
        if (legacy.isEmpty()) return;
        for (Community c : legacy) {
            if (c.getVisibility() == null) c.setVisibility("PUBLIC");
            if (c.getApprovalStatus() == null) c.setApprovalStatus("APPROVED");
        }
        communityRepository.saveAll(legacy);
    }

    private void seedCommunities() {
        if (communityRepository.count() > 0) return;

        Community c1 = new Community();
        c1.setName("Istanbul Rock Sahnesi");
        c1.setType("Rock");
        c1.setCity("Istanbul");
        c1.setEmoji("🎸");
        c1.setGradientStart("#E94560");
        c1.setGradientEnd("#7C3AED");
        c1.setDescription("Rock konserleri, mekan onerileri ve konser sonrasi yorumlar.");
        c1.setNextEvent("Dorock XL bulusmasi");
        c1.setTags("Rock,Metal,Istanbul");
        c1.setLive(true);
        c1.setApprovalStatus("APPROVED");
        communityRepository.save(c1);

        Community c2 = new Community();
        c2.setName("Festivalciler");
        c2.setType("Festival");
        c2.setCity("Turkiye");
        c2.setEmoji("🎪");
        c2.setGradientStart("#F5A623");
        c2.setGradientEnd("#E94560");
        c2.setDescription("Festival planlari, kamp tavsiyeleri ve line-up sohbetleri.");
        c2.setNextEvent("Yaz festivali hazirliklari");
        c2.setTags("Festival,Kamp,Line-up");
        c2.setLive(true);
        c2.setApprovalStatus("APPROVED");
        communityRepository.save(c2);

        Community c3 = new Community();
        c3.setName("Elektronik Gece");
        c3.setType("Elektronik");
        c3.setCity("Istanbul");
        c3.setEmoji("🎧");
        c3.setGradientStart("#00D4AA");
        c3.setGradientEnd("#0066FF");
        c3.setDescription("DJ setleri, after party duyurulari ve elektronik muzik kulturleri.");
        c3.setNextEvent("Gece setleri listesi");
        c3.setTags("DJ,Techno,House");
        c3.setLive(false);
        c3.setApprovalStatus("APPROVED");
        communityRepository.save(c3);

        Community c4 = new Community();
        c4.setName("Ankara Konser Grubu");
        c4.setType("Sehir");
        c4.setCity("Ankara");
        c4.setEmoji("📍");
        c4.setGradientStart("#7C3AED");
        c4.setGradientEnd("#E94560");
        c4.setDescription("Ankara konserleri, bilet paylasimlari ve etkinlik oncesi bulusmalar.");
        c4.setNextEvent("Haftanin Ankara konserleri");
        c4.setTags("Ankara,Bulusma,Konser");
        c4.setLive(false);
        c4.setApprovalStatus("APPROVED");
        communityRepository.save(c4);

        Community c5 = new Community();
        c5.setName("Caz Severler");
        c5.setType("Caz");
        c5.setCity("Turkiye");
        c5.setEmoji("🎷");
        c5.setGradientStart("#16213E");
        c5.setGradientEnd("#F5A623");
        c5.setDescription("Caz kulubu onerileri, konser notlari ve sakin performanslar.");
        c5.setNextEvent("Caz kulubu rotasi");
        c5.setTags("Caz,Akustik,Kulup");
        c5.setLive(false);
        c5.setApprovalStatus("APPROVED");
        communityRepository.save(c5);
    }

    private void seedArtists() {
        if (artistRepository.count() > 0) return;

        seedArtist("Duman", "Rock", null, null);
        seedArtist("Mor ve Otesi", "Rock", null, null);
        seedArtist("Sebnem Ferah", "Rock", null, null);
        seedArtist("Manga", "Rock", null, null);
        seedArtist("She Past Away", "Rock", null, null);
        seedArtist("Kaan Tangoze", "Rock", null, null);
        seedArtist("Metallica", "Metal", null, null);
        seedArtist("Pentagram", "Metal", null, null);
        seedArtist("Tarkan", "Pop", null, null);
        seedArtist("Sila", "Pop", null, null);
        seedArtist("Mabel Matiz", "Pop", null, null);
        seedArtist("Ceza", "Rap", null, null);
        seedArtist("Sagopa Kajmer", "Rap", null, null);
        seedArtist("Ezhel", "Rap", null, null);
        seedArtist("Arctic Monkeys", "Indie", null, null);
        seedArtist("Hipermob", "Indie", null, null);
        seedArtist("BUN", "Elektronik", null, null);
        seedArtist("hey! doug", "Elektronik", null, null);
        seedArtist("Dolu Kadehi Ters Tut", "Alternatif Rock", null, null);
        seedArtist("Son Feci Bisiklet", "Alternatif Rock", null, null);
        seedArtist("Can Bonomo", "Alternatif Rock", null, null);
    }

    private void seedArtist(String name, String genre, String imageUrl, String spotifyId) {
        Artist a = new Artist();
        a.setName(name);
        a.setGenre(genre);
        a.setImageUrl(imageUrl);
        a.setSpotifyId(spotifyId);
        artistRepository.save(a);
    }
}
