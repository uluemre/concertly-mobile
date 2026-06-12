package com.concertly.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "daily_song_plays", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "epochDay"})
})
public class DailySongPlay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Oyunun günü — LocalDate.toEpochDay() */
    @Column(nullable = false)
    private long epochDay;

    private int attemptsUsed;
    private boolean solved;
    /** Kaçıncı denemede bildi (1-5), bilemediyse 0 */
    private int solvedAttempt;

    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public long getEpochDay() { return epochDay; }
    public void setEpochDay(long epochDay) { this.epochDay = epochDay; }
    public int getAttemptsUsed() { return attemptsUsed; }
    public void setAttemptsUsed(int attemptsUsed) { this.attemptsUsed = attemptsUsed; }
    public boolean isSolved() { return solved; }
    public void setSolved(boolean solved) { this.solved = solved; }
    public int getSolvedAttempt() { return solvedAttempt; }
    public void setSolvedAttempt(int solvedAttempt) { this.solvedAttempt = solvedAttempt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
