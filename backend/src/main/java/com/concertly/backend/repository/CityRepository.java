package com.concertly.backend.repository;

import com.concertly.backend.model.City;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CityRepository extends JpaRepository<City, Long> {

    List<City> findAllByOrderByPlateAsc();
}
