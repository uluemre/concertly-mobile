package com.concertly.backend.repository;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class SearchTextTest {

    @Test
    void turkishLettersAndCaseAreFolded() {
        assertEquals("sebnem ferah", SearchText.fold("Şebnem Ferah"));
        assertEquals(SearchText.fold("istanbul"), SearchText.fold("İstanbul"));
        assertEquals(SearchText.fold("istanbul"), SearchText.fold("ISTANBUL"));
        assertEquals(SearchText.fold("istanbul"), SearchText.fold("İSTANBUL"));
        assertEquals("cigdem gunes oz", SearchText.fold("ÇİĞDEM GÜNEŞ ÖZ"));
        assertEquals("kazim", SearchText.fold("Kâzım"));
    }

    @Test
    void likeWildcardsAreEscaped() {
        assertEquals("%a!_a%", SearchText.containsPattern("a_a"));
        assertEquals("%!%!%%", SearchText.containsPattern("%%"));
        assertEquals("%a!!b%", SearchText.containsPattern("a!b"));
        assertEquals("%sim!_%", SearchText.containsPattern("SIM_"));
    }

    @Test
    void foldTablesStayAligned() {
        assertEquals(SearchText.FOLD_FROM.length(), SearchText.FOLD_TO.length());
    }
}
