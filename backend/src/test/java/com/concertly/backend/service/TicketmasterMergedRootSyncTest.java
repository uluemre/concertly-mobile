package com.concertly.backend.service;

import com.concertly.backend.config.LaunchCityConfig;
import com.concertly.backend.model.Artist;
import com.concertly.backend.model.Venue;
import com.concertly.backend.repository.ArtistFollowRepository;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.VenueRepository;
import com.concertly.backend.service.ingest.EventSourceLinkService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/** Regresyon: birlestirme ile cozulen asil sanatci/mekan Ticketmaster senkronunda ezilmemeli. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TicketmasterMergedRootSyncTest {

    @Mock private EventRepository eventRepository;
    @Mock private ArtistRepository artistRepository;
    @Mock private VenueRepository venueRepository;
    @Mock private SpotifyService spotifyService;
    @Mock private DeezerService deezerService;
    @Mock private ArtistFollowRepository artistFollowRepository;
    @Mock private NotificationService notificationService;
    @Mock private LaunchCityConfig launchCityConfig;
    @Mock private EventSourceLinkService sourceLinks;

    private TicketmasterService service;

    @BeforeEach
    void setUp() {
        service = new TicketmasterService(eventRepository, artistRepository, venueRepository, spotifyService,
                deezerService, artistFollowRepository, notificationService, launchCityConfig, sourceLinks);
        when(artistRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(venueRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private Artist artist(Map<String, Object> emb) {
        return (Artist) ReflectionTestUtils.invokeMethod(service, "extractOrCreateArtist", emb, "EV-1", "Sila");
    }

    private Venue venue(Map<String, Object> emb) {
        return (Venue) ReflectionTestUtils.invokeMethod(service, "extractOrCreateVenue", emb, "Istanbul");
    }

    private static Map<String, Object> artistEmb() {
        return Map.of("attractions", List.of(Map.of("id", "ATT-1", "name", "Sila")));
    }

    private static Map<String, Object> venueEmb() {
        return Map.of("venues", List.of(Map.of("id", "VEN-DUP", "name", "TM Sahne",
                "city", Map.of("name", "Ankara"),
                "address", Map.of("line1", "TM Adres"),
                "location", Map.of("latitude", "1.5", "longitude", "2.5"))));
    }

    @Test
    void resyncOfRenamedArtistRootKeepsRootName() {
        Artist root = new Artist();
        ReflectionTestUtils.setField(root, "id", 5L);
        root.setName("Sıla");
        root.setExternalId("ATT-1");
        when(artistRepository.findExisting("ATT-1", "Sila")).thenReturn(Optional.of(root));

        Artist result = artist(artistEmb());

        assertEquals("Sıla", result.getName());
    }

    @Test
    void existingArtistWithBlankNameGetsTmName() {
        Artist root = new Artist();
        ReflectionTestUtils.setField(root, "id", 5L);
        root.setName(" ");
        when(artistRepository.findExisting("ATT-1", "Sila")).thenReturn(Optional.of(root));

        assertEquals("Sila", artist(artistEmb()).getName());
    }

    @Test
    void newArtistGetsTmValues() {
        when(artistRepository.findExisting("ATT-1", "Sila")).thenReturn(Optional.empty());

        Artist result = artist(artistEmb());

        assertEquals("Sila", result.getName());
        assertEquals("ATT-1", result.getExternalId());
    }

    @Test
    void venueRootWithoutExternalIdIsNotOverwrittenAndOnlyBlanksFilled() {
        Venue root = new Venue();
        ReflectionTestUtils.setField(root, "id", 7L);
        root.setName("Biletinial Salon");
        root.setCity("Izmir");
        root.setLatitude(10.0);
        root.setLongitude(20.0);
        when(venueRepository.findByExternalId("VEN-DUP")).thenReturn(Optional.of(root));

        Venue result = venue(venueEmb());

        assertSame(root, result);
        assertEquals("Biletinial Salon", result.getName());
        assertEquals("Izmir", result.getCity());
        assertEquals(10.0, result.getLatitude());
        assertEquals(20.0, result.getLongitude());
        assertNull(result.getExternalId(), "kopyanin kimligi asil kayda yazilmamali");
        assertEquals("TM Adres", result.getAddress(), "bos alan doldurulur");
    }

    @Test
    void venueRootWithDifferentExternalIdIsNotOverwritten() {
        Venue root = new Venue();
        ReflectionTestUtils.setField(root, "id", 7L);
        root.setName("Kok Mekan");
        root.setExternalId("VEN-ROOT");
        root.setCity("Izmir");
        when(venueRepository.findByExternalId("VEN-DUP")).thenReturn(Optional.of(root));

        Venue result = venue(venueEmb());

        assertEquals("Kok Mekan", result.getName());
        assertEquals("Izmir", result.getCity());
        assertEquals("VEN-ROOT", result.getExternalId());
    }

    @Test
    void newVenueGetsTmValues() {
        when(venueRepository.findByExternalId("VEN-DUP")).thenReturn(Optional.empty());

        Venue result = venue(venueEmb());

        assertEquals("TM Sahne", result.getName());
        assertEquals("Ankara", result.getCity());
        assertEquals("VEN-DUP", result.getExternalId());
        assertEquals(1.5, result.getLatitude());
    }
}
