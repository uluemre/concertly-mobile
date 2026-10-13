package com.concertly.backend.service;

import com.concertly.backend.model.AppSetting;
import com.concertly.backend.repository.AppSettingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AppSettingsServiceTest {

    @Mock private AppSettingRepository repository;

    private final Map<String, AppSetting> store = new HashMap<>();
    private AppSettingsService service;

    @BeforeEach
    void setUp() {
        when(repository.findAll()).thenAnswer(inv -> new ArrayList<>(store.values()));
        when(repository.findById(any())).thenAnswer(inv -> Optional.ofNullable(store.get((String) inv.getArgument(0))));
        when(repository.save(any())).thenAnswer(inv -> {
            AppSetting s = inv.getArgument(0);
            store.put(s.getKey(), s);
            return s;
        });
        service = new AppSettingsService(repository, 48, 10, 50, 50, 30, 10);
        service.reload();
    }

    @Test
    void defaultsWhenNothingSaved() {
        assertFalse(service.isOn(AppSettingsService.MAINTENANCE));
        assertTrue(service.isOn(AppSettingsService.FEATURE_BUDDY));
        assertEquals("48", service.get(AppSettingsService.NEW_ACCOUNT_HOURS));
        // Kayıt yoksa servisin kendi yedeği döner
        assertEquals(77, service.getLong(AppSettingsService.NEW_ACCOUNT_MAX_POSTS, 77));
        assertNull(service.publicConfig().get("announcement"));
    }

    @Test
    void updateSavesAndReturnsDiff() {
        List<String> diff = service.update(Map.of(AppSettingsService.FEATURE_GAMES, false,
                AppSettingsService.NEW_ACCOUNT_MAX_POSTS, "5"), "d");
        assertEquals(2, diff.size());
        assertFalse(service.isOn(AppSettingsService.FEATURE_GAMES));
        assertEquals(5, service.getLong(AppSettingsService.NEW_ACCOUNT_MAX_POSTS, 10));
        assertEquals("d", store.get(AppSettingsService.FEATURE_GAMES).getUpdatedBy());
    }

    @Test
    void unchangedValueIsNotWritten() {
        assertTrue(service.update(Map.of(AppSettingsService.FEATURE_BUDDY, true), "d").isEmpty());
        verify(repository, never()).save(any());
    }

    @Test
    void invalidValueRejectsWholeBatch() {
        Map<String, Object> changes = new LinkedHashMap<>();
        changes.put(AppSettingsService.FEATURE_GAMES, false);
        changes.put(AppSettingsService.NEW_ACCOUNT_HOURS, 9999);
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.update(changes, "d"));
        assertEquals("SETTING_OUT_OF_RANGE", ex.getMessage());
        assertTrue(service.isOn(AppSettingsService.FEATURE_GAMES));
        verify(repository, never()).save(any());
    }

    @Test
    void rejectsUnknownKeysAndHiddenVersion() {
        assertThrows(IllegalArgumentException.class, () -> service.update(Map.of("nope", "1"), "d"));
        assertThrows(IllegalArgumentException.class,
                () -> service.update(Map.of(AppSettingsService.ANNOUNCEMENT_VERSION, "5"), "d"));
        assertThrows(IllegalArgumentException.class,
                () -> service.update(Map.of(AppSettingsService.MAINTENANCE, "yes"), "d"));
    }

    @Test
    void linkMustBeHttpsOrAppScheme() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.update(Map.of(AppSettingsService.ANNOUNCEMENT_LINK, "javascript:alert(1)"), "d"));
        assertEquals("INVALID_LINK", ex.getMessage());
        assertThrows(IllegalArgumentException.class,
                () -> service.update(Map.of(AppSettingsService.ANNOUNCEMENT_LINK, "http://x.com"), "d"));
        service.update(Map.of(AppSettingsService.ANNOUNCEMENT_LINK, "concertly://event/12"), "d");
        assertEquals("concertly://event/12", service.get(AppSettingsService.ANNOUNCEMENT_LINK));
    }

    @Test
    void announcementVisibleOnlyWhenOnWithTextAndVersionBumps() {
        service.update(Map.of(AppSettingsService.ANNOUNCEMENT, true), "d");
        assertNull(service.publicConfig().get("announcement"), "metinsiz duyuru gösterilmez");

        service.update(Map.of(AppSettingsService.ANNOUNCEMENT_TR, "Merhaba"), "d");
        @SuppressWarnings("unchecked")
        Map<String, Object> a = (Map<String, Object>) service.publicConfig().get("announcement");
        assertEquals("Merhaba", a.get("textTr"));
        long v1 = (long) a.get("version");

        service.update(Map.of(AppSettingsService.ANNOUNCEMENT_TR, "Yeni duyuru"), "d");
        @SuppressWarnings("unchecked")
        Map<String, Object> b = (Map<String, Object>) service.publicConfig().get("announcement");
        assertTrue((long) b.get("version") > v1, "metin değişince sürüm artar");

        // Kapatıp açmak da sürümü artırır: daha önce kapatanlar yeniden görür
        service.update(Map.of(AppSettingsService.ANNOUNCEMENT, false), "d");
        long before = service.getLong(AppSettingsService.ANNOUNCEMENT_VERSION, 0);
        service.update(Map.of(AppSettingsService.ANNOUNCEMENT, true), "d");
        assertEquals(before + 1, service.getLong(AppSettingsService.ANNOUNCEMENT_VERSION, 0));
    }

    @Test
    void textIsTrimmedAndLengthChecked() {
        service.update(Map.of(AppSettingsService.MAINTENANCE_MSG_TR, "  Bakımdayız  "), "d");
        assertEquals("Bakımdayız", service.get(AppSettingsService.MAINTENANCE_MSG_TR));
        assertThrows(IllegalArgumentException.class,
                () -> service.update(Map.of(AppSettingsService.MAINTENANCE_MSG_TR, "x".repeat(301)), "d"));
    }

    @Test
    void adminListHidesVersionAndShowsRanges() {
        List<AppSettingsService.AdminSetting> list = service.adminList();
        assertTrue(list.stream().noneMatch(s -> s.key().equals(AppSettingsService.ANNOUNCEMENT_VERSION)));
        AppSettingsService.AdminSetting hours = list.stream()
                .filter(s -> s.key().equals(AppSettingsService.NEW_ACCOUNT_HOURS)).findFirst().orElseThrow();
        assertEquals(0L, hours.min());
        assertEquals(720L, hours.max());
        assertEquals("48", hours.defaultValue());
    }
}
