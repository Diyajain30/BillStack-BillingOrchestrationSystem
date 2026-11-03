package com.example.demo.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "events")
public class SubEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "event_id")
    private Long id;

    @Column(nullable = false)
    private String name;

    private String festName = "Wings Technical Fest";

    private String department;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private Double budgetCap;

    private Double advanceDisbursed = 0.0;

    private Double totalSpent = 0.0;

    @Column(name = "wing_name")
    private String wingName;

    @Column(name = "parent_event_id")
    private Long parentEventId;

    @Column(name = "main_head_id")
    private Long mainHeadId;

    private Boolean closureRequested = false;
    private Boolean facultyClosureApproved = false;
    private Boolean studentHeadClosureApproved = false;
    private Boolean principalClosureSanctioned = false;
    private Boolean storekeeperClosureVerified = false;

    @Column(nullable = false)
    private String status = "OPEN";

    public SubEvent() {}

    public SubEvent(String name, String department, String description, Double budgetCap, Double advanceDisbursed) {
        this.name = name;
        this.department = department;
        this.description = description;
        this.budgetCap = budgetCap;
        this.advanceDisbursed = advanceDisbursed != null ? advanceDisbursed : 0.0;
        this.status = "OPEN";
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getFestName() { return festName; }
    public void setFestName(String festName) { this.festName = festName; }

    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Double getBudgetCap() { return budgetCap; }
    public void setBudgetCap(Double budgetCap) { this.budgetCap = budgetCap; }

    public Double getAdvanceDisbursed() { return advanceDisbursed; }
    public void setAdvanceDisbursed(Double advanceDisbursed) { this.advanceDisbursed = advanceDisbursed; }

    public Double getTotalSpent() { return totalSpent; }
    public void setTotalSpent(Double totalSpent) { this.totalSpent = totalSpent; }

    public String getWingName() { return wingName; }
    public void setWingName(String wingName) { this.wingName = wingName; }

    public Long getParentEventId() { return parentEventId; }
    public void setParentEventId(Long parentEventId) { this.parentEventId = parentEventId; }

    public Long getMainHeadId() { return mainHeadId; }
    public void setMainHeadId(Long mainHeadId) { this.mainHeadId = mainHeadId; }

    public Boolean getClosureRequested() { return closureRequested; }
    public void setClosureRequested(Boolean closureRequested) { this.closureRequested = closureRequested; }

    public Boolean getFacultyClosureApproved() { return facultyClosureApproved; }
    public void setFacultyClosureApproved(Boolean facultyClosureApproved) { this.facultyClosureApproved = facultyClosureApproved; }

    public Boolean getStudentHeadClosureApproved() { return studentHeadClosureApproved; }
    public void setStudentHeadClosureApproved(Boolean studentHeadClosureApproved) { this.studentHeadClosureApproved = studentHeadClosureApproved; }

    public Boolean getPrincipalClosureSanctioned() { return principalClosureSanctioned; }
    public void setPrincipalClosureSanctioned(Boolean principalClosureSanctioned) { this.principalClosureSanctioned = principalClosureSanctioned; }

    public Boolean getStorekeeperClosureVerified() { return storekeeperClosureVerified; }
    public void setStorekeeperClosureVerified(Boolean storekeeperClosureVerified) { this.storekeeperClosureVerified = storekeeperClosureVerified; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}