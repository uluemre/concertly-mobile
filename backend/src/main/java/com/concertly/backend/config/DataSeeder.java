package com.concertly.backend.config;

import com.concertly.backend.model.Community;
import com.concertly.backend.repository.CommunityRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataSeeder implements CommandLineRunner {

    private final CommunityRepository communityRepository;

    public DataSeeder(CommunityRepository communityRepository) {
        this.communityRepository = communityRepository;
    }

    @Override
    public void run(String... args) {
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
        communityRepository.save(c5);
    }
}
