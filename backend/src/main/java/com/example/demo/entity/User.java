package com.example.demo.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String role; // STUDENT_COORDINATOR, STUDENT_HEAD, FACULTY, PRINCIPAL, STOREKEEPER, ACCOUNTS

    // Roll Number for students, Staff ID for faculty/principal/store/accounts
    @Column(nullable = false)
    private String institutionalId;

    // Applicable for Student Coordinators and Faculty
    private String department;

    // Sub-event linkage for scoped data access
    private Long assignedSubEventId;

    public User() {}

    public User(String username, String password, String name, String role, 
                String institutionalId, String department, Long assignedSubEventId) {
        this.username = username;
        this.password = password;
        this.name = name;
        this.role = role;
        this.institutionalId = institutionalId;
        this.department = department;
        this.assignedSubEventId = assignedSubEventId;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getInstitutionalId() { return institutionalId; }
    public void setInstitutionalId(String institutionalId) { this.institutionalId = institutionalId; }

    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }

    public Long getAssignedSubEventId() { return assignedSubEventId; }
    public void setAssignedSubEventId(Long assignedSubEventId) { this.assignedSubEventId = assignedSubEventId; }
}