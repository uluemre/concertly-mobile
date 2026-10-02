package com.concertly.backend.controller;

import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Event;
import com.concertly.backend.repository.EventRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Admin etkinlik silme: bağlı verisi olan etkinlik FK hatası yerine listeden kaldırılır. */
class AdminEventDeleteTest {

    private EventRepository eventRepository;
    private Query query;
    private AdminController controller;

    @BeforeEach
    void setUp() {
        eventRepository = mock(EventRepository.class);
        EntityManager em = mock(EntityManager.class);
        query = mock(Query.class);
        when(em.createNativeQuery(anyString())).thenReturn(query);
        when(query.setParameter(anyString(), any())).thenReturn(query);
        controller = new AdminController(null, eventRepository, null, null, null, null, null,
                null, null, null, null, null, null, null);
        ReflectionTestUtils.setField(controller, "em", em);
    }

    private Event event(long id) {
        Event e = new Event();
        ReflectionTestUtils.setField(e, "id", id);
        e.setIsApproved(true);
        return e;
    }

    @Test
    void eventWithoutReferencesIsHardDeleted() {
        Event e = event(1L);
        when(eventRepository.findById(1L)).thenReturn(Optional.of(e));
        when(query.getSingleResult()).thenReturn(0L);

        controller.deleteEvent(1L);

        verify(eventRepository).delete(e);
        verify(eventRepository, never()).save(any());
    }

    @Test
    void eventWithReferencesIsDelistedNotDeleted() {
        Event e = event(2L);
        when(eventRepository.findById(2L)).thenReturn(Optional.of(e));
        when(query.getSingleResult()).thenReturn(3L);

        controller.deleteEvent(2L);

        verify(eventRepository, never()).delete(any());
        verify(eventRepository, never()).deleteById(any());
        verify(eventRepository).save(e);
        assertThat(e.getDelistedReason()).isEqualTo(AdminController.ADMIN_REMOVED);
        assertThat(e.getIsApproved()).isFalse();
        assertThat(e.listedPublicly()).isFalse();
    }

    @Test
    void missingEventIs404() {
        when(eventRepository.findById(9L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> controller.deleteEvent(9L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void adminRemovedEventsAreHiddenFromAdminList() {
        Event kept = event(3L);
        kept.setEventDate(java.time.LocalDateTime.now());
        Event removed = event(4L);
        removed.setEventDate(java.time.LocalDateTime.now());
        removed.setDelistedReason(AdminController.ADMIN_REMOVED);
        when(eventRepository.findAll()).thenReturn(new java.util.ArrayList<>(List.of(kept, removed)));

        assertThat(controller.getEvents(null)).extracting("id").containsExactly(3L);
    }
}
