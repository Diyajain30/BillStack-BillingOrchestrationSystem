package com.example.demo.controller;

import com.example.demo.entity.User;
import com.example.demo.repository.UserRepository;
import com.example.demo.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
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

    // GET /api/users - Retrieve all users (Optional role/department filtering)
    @GetMapping
    public ResponseEntity<List<User>> getAllUsers(
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String department) {
        
        List<User> users = userRepository.findAll();

        if (role != null && !role.isBlank()) {
            users = users.stream()
                    .filter(u -> u.getRole() != null && u.getRole().equalsIgnoreCase(role))
                    .toList();
        }

        if (department != null && !department.isBlank()) {
            users = users.stream()
                    .filter(u -> u.getDepartment() != null && u.getDepartment().equalsIgnoreCase(department))
                    .toList();
        }

        return ResponseEntity.ok(users);
    }

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

        if (user.getRole() != null) {
            user.setRole(user.getRole().toUpperCase());
        } else {
            user.setRole("STUDENT");
        }

        // Coordinators and Faculty register unassigned initially; assigned later by Student Head
        user.setAssignedSubEventId(null);

        if (userRepository.findByUsername(user.getUsername()).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", "Username already exists."));
        }

        User savedUser = userRepository.save(user);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedUser);
    }

    // POST /api/users/create-student-head - Main Event Head creates Student Head credentials
    @PostMapping("/create-student-head")
    public ResponseEntity<?> createStudentHead(@RequestBody User studentHead) {
        try {
            if (studentHead.getUsername() == null || studentHead.getUsername().trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "Username is required."));
            }
            if (studentHead.getPassword() == null || studentHead.getPassword().length() < 4) {
                return ResponseEntity.badRequest().body(Map.of("message", "Password must be at least 4 characters."));
            }

            // Fallback default institutional ID if left blank to satisfy database constraints
            if (studentHead.getInstitutionalId() == null || studentHead.getInstitutionalId().trim().isEmpty()) {
                studentHead.setInstitutionalId("SH-" + System.currentTimeMillis());
            }

            if (userRepository.findByUsername(studentHead.getUsername()).isPresent()) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", "Username already exists."));
            }

            studentHead.setRole("STUDENT_HEAD");
            User savedUser = userRepository.save(studentHead);
            return ResponseEntity.status(HttpStatus.CREATED).body(savedUser);
            
        } catch (Exception e) {
            e.printStackTrace(); // Prints exact error in backend console
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Server Error: " + e.getMessage()));
        }
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

    // PUT /api/users/{id} - Update user profile or sub-event assignment
    @PutMapping("/{id}")
    public ResponseEntity<?> updateUser(@PathVariable Long id, @RequestBody User updatedData) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOpt.get();
        if (updatedData.getName() != null) user.setName(updatedData.getName());
        if (updatedData.getUsername() != null) user.setUsername(updatedData.getUsername());
        if (updatedData.getRole() != null) user.setRole(updatedData.getRole());
        if (updatedData.getDepartment() != null) user.setDepartment(updatedData.getDepartment());
        if (updatedData.getInstitutionalId() != null) user.setInstitutionalId(updatedData.getInstitutionalId());
        if (updatedData.getAssignedSubEventId() != null) user.setAssignedSubEventId(updatedData.getAssignedSubEventId());

        User saved = userRepository.save(user);
        return ResponseEntity.ok(saved);
    }

    // DELETE /api/users/{id} - Remove user profile
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        if (!userRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        userRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "User deleted successfully."));
    }
}