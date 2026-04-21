package com.concertly.backend.model;

import jakarta.persistence.*;

@Entity
@Table(name = "roles")
public class Role {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    public Long getId() { return id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}