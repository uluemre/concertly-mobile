package com.concertly.backend.dto.response;

import com.concertly.backend.model.Community;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public class CommunityResponse {

    private Long id;
    private String name;
    private String type;
    private String city;
    private String emoji;
    private String gradientStart;
    private String gradientEnd;
    private String description;
    private String nextEvent;
    private List<String> tags;
    private Boolean live;
    private long memberCount;
    private long postCount;

    @JsonProperty("isJoinedByCurrentUser")
    private boolean isJoinedByCurrentUser;

    public static CommunityResponse from(Community community,
                                          long memberCount,
                                          long postCount,
                                          boolean isJoinedByCurrentUser) {
        CommunityResponse dto = new CommunityResponse();
        dto.id = community.getId();
        dto.name = community.getName();
        dto.type = community.getType();
        dto.city = community.getCity();
        dto.emoji = community.getEmoji();
        dto.gradientStart = community.getGradientStart();
        dto.gradientEnd = community.getGradientEnd();
        dto.description = community.getDescription();
        dto.nextEvent = community.getNextEvent();
        dto.live = community.getLive();
        dto.memberCount = memberCount;
        dto.postCount = postCount;
        dto.isJoinedByCurrentUser = isJoinedByCurrentUser;

        if (community.getTags() != null && !community.getTags().isBlank()) {
            dto.tags = Arrays.asList(community.getTags().split(","));
        } else {
            dto.tags = Collections.emptyList();
        }

        return dto;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getType() { return type; }
    public String getCity() { return city; }
    public String getEmoji() { return emoji; }
    public String getGradientStart() { return gradientStart; }
    public String getGradientEnd() { return gradientEnd; }
    public String getDescription() { return description; }
    public String getNextEvent() { return nextEvent; }
    public List<String> getTags() { return tags; }
    public Boolean getLive() { return live; }
    public long getMemberCount() { return memberCount; }
    public long getPostCount() { return postCount; }
    public boolean isJoinedByCurrentUser() { return isJoinedByCurrentUser; }
}
