package com.concertly.backend.service;

import com.concertly.backend.dto.response.CommunityResponse;
import com.concertly.backend.model.Community;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

/** B1-bos QA: istemcinin okudugu JSON alan adi tam olarak "archived" (isArchived degil). */
class CommunityResponseArchivedJsonTest {

    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();

    @Test
    void archivedSerializesAsArchivedTrue() throws Exception {
        Community c = new Community();
        c.setArchivedAt(LocalDateTime.now());
        JsonNode n = mapper.valueToTree(CommunityResponse.from(c, 1, 0, null, null, null));
        assertTrue(n.has("archived"));
        assertTrue(n.get("archived").asBoolean());
        assertFalse(n.has("isArchived"));
        assertFalse(n.has("archivedAt"), "zaman damgasi sizdirilmaz");
    }

    @Test
    void nonArchivedSerializesAsArchivedFalseNotMissing() throws Exception {
        JsonNode n = mapper.valueToTree(CommunityResponse.from(new Community(), 1, 0, null, null, null));
        assertTrue(n.has("archived"));
        assertFalse(n.get("archived").asBoolean());
    }
}
