package com.example.demo.controller;

import com.example.demo.entity.User;
import com.example.demo.repository.UserRepository;
import com.example.demo.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "http://localhost:3000")
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtil jwtUtil;

    // POST /api/users - Decoupled Registration
    @PostMapping
    public ResponseEntity<?> registerUser(@RequestBody User user) {
        if (user.getUsername() == null || user.getUsername().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Username is required."));
        }
        if (user.getPassword() == null || user.getPassword().length() < 4) {
            return ResponseEntity.badRequest().body(Map.of("message", "Password must be at least 4 characters."));
        }
        if (user.getInstitutionalId() == null || user.getInstitutionalId().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Roll Number or Staff ID is required."));
        }

        user.setRole(user.getRole().toUpperCase());

        // Coordinators and Faculty register unassigned initially; assigned later by Student Head
        user.setAssignedSubEventId(null);

        if (userRepository.findByUsername(user.getUsername()).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", "Username already exists."));
        }

        User savedUser = userRepository.save(user);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedUser);
    }

    // POST /api/users/login - Role-Confirmed Authentication with JWT
    @PostMapping("/login")
    public ResponseEntity<?> loginUser(@RequestBody Map<String, String> loginData) {
        String username = loginData.get("username");
        String password = loginData.get("password");
        String requestedRole = loginData.get("role");

        if (username == null || password == null || requestedRole == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Username, password, and role are required."));
        }

        Optional<User> userOpt = userRepository.findByUsername(username);

        if (userOpt.isEmpty() || !userOpt.get().getPassword().equals(password)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid username or password."));
        }

        User user = userOpt.get();

        // Role Confirmation Check
        if (!user.getRole().equalsIgnoreCase(requestedRole.trim())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "message", "Role mismatch! This account is registered as " + user.getRole() + "."
            ));
        }

        // Issue token containing profile claims
        String token = jwtUtil.generateToken(user);

        Map<String, Object> response = new HashMap<>();
        response.put("token", token);
        response.put("user", user);

        return ResponseEntity.ok(response);
    }

    // GET /api/users/{id} - Sync session with database assignment
    @GetMapping("/{id}")
    public ResponseEntity<?> getUserById(@PathVariable Long id) {
        return userRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}