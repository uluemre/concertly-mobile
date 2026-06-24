package com.concertly.backend.dto.request;

public class CreateCommunityRequest {

    private String name;
    private String type;
    private String city;
    private String emoji;
    private String description;
    private String gradientStart;
    private String gradientEnd;
    private String tags;
    private String visibility; // PUBLIC | PRIVATE | SECRET

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getEmoji() { return emoji; }
    public void setEmoji(String emoji) { this.emoji = emoji; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getGradientStart() { return gradientStart; }
    public void setGradientStart(String gradientStart) { this.gradientStart = gradientStart; }

    public String getGradientEnd() { return gradientEnd; }
    public void setGradientEnd(String gradientEnd) { this.gradientEnd = gradientEnd; }

    public String getTags() { return tags; }
    public void setTags(String tags) { this.tags = tags; }

    public String getVisibility() { return visibility; }
    public void setVisibility(String visibility) { this.visibility = visibility; }
}
