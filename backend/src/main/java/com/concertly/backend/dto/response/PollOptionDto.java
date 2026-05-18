package com.concertly.backend.dto.response;

public class PollOptionDto {
    private Long id;
    private String optionText;
    private long voteCount;
    private boolean voted;

    public static PollOptionDto of(Long id, String text, long voteCount, boolean voted) {
        PollOptionDto dto = new PollOptionDto();
        dto.id = id;
        dto.optionText = text;
        dto.voteCount = voteCount;
        dto.voted = voted;
        return dto;
    }

    public Long getId() { return id; }
    public String getOptionText() { return optionText; }
    public long getVoteCount() { return voteCount; }
    public boolean isVoted() { return voted; }
}
