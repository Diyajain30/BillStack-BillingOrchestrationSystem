package com.example.demo.repository;

import com.example.demo.entity.SubEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface SubEventRepository extends JpaRepository<SubEvent, Long> {
    Optional<SubEvent> findByName(String name);
}