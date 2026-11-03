package com.example.demo.repository;

import com.example.demo.entity.SubEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SubEventRepository extends JpaRepository<SubEvent, Long> {
    Optional<SubEvent> findByName(String name);
}