package com.concertly.backend.service;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Görüntülenme: kişi başı tek anahtar, ham IP saklanmaz, organizatörün kendisi sayılmaz. */
class EventViewServiceTest {

    @Test
    void loggedInViewerIsKeyedByUser() {
        assertEquals("u:42", EventViewService.viewerKey(42L, new MockHttpServletRequest()));
    }

    @Test
    void anonymousViewerIsHashedAndStable() {
        MockHttpServletRequest a = new MockHttpServletRequest();
        a.addHeader("X-Forwarded-For", "85.10.20.30, 10.0.0.1");
        a.addHeader("User-Agent", "Expo");
        MockHttpServletRequest sameDevice = new MockHttpServletRequest();
        sameDevice.addHeader("X-Forwarded-For", "85.10.20.30");
        sameDevice.addHeader("User-Agent", "Expo");
        MockHttpServletRequest other = new MockHttpServletRequest();
        other.addHeader("X-Forwarded-For", "85.10.20.31");
        other.addHeader("User-Agent", "Expo");

        String key = EventViewService.viewerKey(null, a);
        assertTrue(key.startsWith("a:"));
        assertFalse(key.contains("85.10"), "ham IP saklanmamalı");
        assertTrue(key.length() <= 80);
        assertEquals(key, EventViewService.viewerKey(null, sameDevice));
        assertNotEquals(key, EventViewService.viewerKey(null, other));
    }

    @Test
    void organizerOwnViewsAreNotCounted() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForList(anyString(), eq(Long.class), eq(10L))).thenReturn(List.of(7L));
        new EventViewService(jdbc).record(10L, 7L, new MockHttpServletRequest());
        verify(jdbc, never()).update(anyString(), any(Object[].class));

        new EventViewService(jdbc).record(10L, 8L, new MockHttpServletRequest());
        verify(jdbc).update(contains("ON CONFLICT DO NOTHING"), eq(10L), eq("u:8"), eq(10L));
    }

    @Test
    void countingErrorNeverBreaksThePage() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForList(anyString(), eq(Long.class), any())).thenThrow(new RuntimeException("db yok"));
        assertDoesNotThrow(() -> new EventViewService(jdbc).record(10L, 7L, new MockHttpServletRequest()));
    }
}
