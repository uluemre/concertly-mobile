package com.concertly.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Uygulamanın kapsadığı şehirler. 81 il burada durur; yalnız açık olanlar listelenir,
 * önerilir ve bilet sitelerinden taranır. Admin panelinden açılıp kapatılır.
 */
@Entity
@Table(name = "cities")
public class City {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Türkçe yazım: "Eskişehir". */
    @Column(nullable = false, unique = true, length = 60)
    private String name;

    /** Bilet sitelerinin adres biçimi: "eskisehir". */
    @Column(nullable = false, unique = true, length = 60)
    private String slug;

    @Column(nullable = false)
    private int plate;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public int getPlate() { return plate; }
    public void setPlate(int plate) { this.plate = plate; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
