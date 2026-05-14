package com.concertly.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "communities")
public class Community {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String type;
    private String city;
    private String emoji;
    private String gradientStart;
    private String gradientEnd;
    private String description;
    private String nextEvent;
    private String tags;

    private Boolean live = false;

    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getEmoji() { return emoji; }
    public void setEmoji(String emoji) { this.emoji = emoji; }

    public String getGradientStart() { return gradientStart; }
    public void setGradientStart(String gradientStart) { this.gradientStart = gradientStart; }

    public String getGradientEnd() { return gradientEnd; }
    public void setGradientEnd(String gradientEnd) { this.gradientEnd = gradientEnd; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getNextEvent() { return nextEvent; }
    public void setNextEvent(String nextEvent) { this.nextEvent = nextEvent; }

    public String getTags() { return tags; }
    public void setTags(String tags) { this.tags = tags; }

    public Boolean getLive() { return live; }
    public void setLive(Boolean live) { this.live = live; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
