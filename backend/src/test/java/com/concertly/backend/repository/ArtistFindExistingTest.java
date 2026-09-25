package com.concertly.backend.repository;

import com.concertly.backend.model.Artist;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** N-09: içe aktarımın sanatçı eşlemesi — kimlik önce, sonra Türkçe harf duyarsız ad. */
class ArtistFindExistingTest {

    private static Artist artist(long id, String name, String externalId) {
        Artist a = new Artist();
        ReflectionTestUtils.setField(a, "id", id);
        a.setName(name);
        a.setExternalId(externalId);
        return a;
    }

    private static ArtistRepository repo(List<Artist> searchResult) {
        ArtistRepository repo = mock(ArtistRepository.class);
        when(repo.findExisting(any(), any())).thenCallRealMethod();
        when(repo.findFirstByExternalIdOrderByIdAsc(anyString())).thenReturn(Optional.empty());
        when(repo.search(anyString())).thenReturn(searchResult);
        return repo;
    }

    @Test
    void turkishSpellingAndPunctuationVariantsFindTheSameArtist() {
        Artist sebnem = artist(2125, "Şebnem Ferah", "Z6HyzZyMZ1A870PZ");
        Artist levi = artist(2397, "Levi Sct.", null);
        Artist sila = artist(1961, "Sila", "K8vZ917CaSf");
        ArtistRepository repo = repo(List.of(sebnem, levi, sila));

        assertEquals(2125L, repo.findExisting(null, "Sebnem Ferah").orElseThrow().getId());
        assertEquals(2397L, repo.findExisting(null, "Levi .Sct").orElseThrow().getId());
        assertEquals(1961L, repo.findExisting(null, "Sıla").orElseThrow().getId());
    }

    @Test
    void externalIdWinsAndDuplicateCopiesPickTheOldest() {
        ArtistRepository repo = repo(List.of());
        Artist oldest = artist(2250, "Aisu", "Z6HyzZyMZ1koa8tbw");
        when(repo.findFirstByExternalIdOrderByIdAsc("Z6HyzZyMZ1koa8tbw")).thenReturn(Optional.of(oldest));

        assertEquals(2250L, repo.findExisting("Z6HyzZyMZ1koa8tbw", "Aisu").orElseThrow().getId());

        // Aynı adla iki eski kopya (Hadise 2898 / 2899): en eski seçilir, yeni kayıt açılmaz
        ArtistRepository hadise = repo(List.of(artist(2899, "Hadise", null), artist(2898, "Hadise", null)));
        assertEquals(2898L, hadise.findExisting(null, "Hadise").orElseThrow().getId());
    }

    @Test
    void differentArtistsSharingAWordAreNotMatched() {
        ArtistRepository repo = repo(List.of(artist(1, "Sila Gençoğlu", null), artist(2, "Mor ve Ötesi", null)));

        assertTrue(repo.findExisting(null, "Sıla").isEmpty(), "yalnızca tam ad anahtarı eşleşir");
        assertTrue(repo.findExisting(null, "Mor").isEmpty());
        assertTrue(repo.findExisting(null, "  ").isEmpty());
        assertTrue(repo.findExisting(null, null).isEmpty());
    }
}
