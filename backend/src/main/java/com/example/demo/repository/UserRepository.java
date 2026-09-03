package com.example.demo.repository;



import com.example.demo.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    // Find user by username for authentication checks
    Optional<User> findByUsername(String username);

    // Check if username already exists during signup
    Boolean existsByUsername(String username);
}