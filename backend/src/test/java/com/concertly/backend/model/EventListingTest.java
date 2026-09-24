package com.concertly.backend.model;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** Herkese açık listelerde yalnızca onaylı ve listeden kaldırılmamış etkinlikler görünür. */
class EventListingTest {

    private static Event event(Boolean approved, String delistedReason) {
        Event e = new Event();
        e.setIsApproved(approved);
        e.setDelistedReason(delistedReason);
        return e;
    }

    @Test
    void approvedEventIsListed() {
        assertTrue(event(true, null).listedPublicly());
    }

    @Test
    void pendingSuggestionIsNotListed() {
        assertFalse(event(false, null).listedPublicly());
        assertFalse(event(null, null).listedPublicly());
    }

    @Test
    void delistedEventStaysHiddenEvenIfApprovedFlagIsSet() {
        // Sync ya da elle yapılan bir değişiklik is_approved'u true bıraksa bile görünmemeli
        assertFalse(event(true, "NOT_MUSIC").listedPublicly());
    }
}
