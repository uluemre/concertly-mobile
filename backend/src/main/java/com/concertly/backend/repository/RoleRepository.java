package com.concertly.backend.repository;

import com.concertly.backend.model.Role;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleRepository extends JpaRepository<Role, Long> {
    java.util.Optional<Role> findByName(String name);
}