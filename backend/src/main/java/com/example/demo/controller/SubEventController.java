package com.example.demo.controller;

import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.example.demo.entity.SubEvent;
import com.example.demo.entity.User;
import com.example.demo.repository.SubEventRepository;
import com.example.demo.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;

@RestController
@RequestMapping({"/api/subevents", "/api/events"})
@CrossOrigin(origins = "http://localhost:3000")
public class SubEventController {

    @Autowired
    private SubEventRepository subEventRepository;

    @Autowired
    private UserRepository userRepository;

    @GetMapping
    public ResponseEntity<List<SubEvent>> getAllSubEvents() {
        return ResponseEntity.ok(subEventRepository.findAll());
    }

    // GET /api/subevents/{id} - Full folder details + assigned personnel
    @GetMapping("/{id}")
    public ResponseEntity<?> getSubEventById(@PathVariable Long id) {
        Optional<SubEvent> subEventOpt = subEventRepository.findById(id);
        if (subEventOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        SubEvent subEvent = subEventOpt.get();
        List<User> facultyHeads = userRepository.findAll().stream()
                .filter(u -> u.getRole() != null && 
                        (u.getRole().toUpperCase().contains("FACULTY") || u.getRole().toUpperCase().contains("TEACHER")) && 
                        id.equals(u.getAssignedSubEventId()))
                .toList();
                
        List<User> coordinators = userRepository.findAll().stream()
                .filter(u -> u.getRole() != null && 
                        (u.getRole().toUpperCase().contains("STUDENT") || u.getRole().toUpperCase().contains("COORDINATOR")) && 
                        id.equals(u.getAssignedSubEventId()))
                .toList();

        Map<String, Object> res = new HashMap<>();
        res.put("id", subEvent.getId());
        res.put("name", subEvent.getName());
        res.put("festName", subEvent.getFestName());
        res.put("department", subEvent.getDepartment());
        res.put("description", subEvent.getDescription());
        res.put("budgetCap", subEvent.getBudgetCap());
        res.put("advanceDisbursed", subEvent.getAdvanceDisbursed());
        res.put("totalSpent", subEvent.getTotalSpent());
        res.put("status", subEvent.getStatus());
        res.put("wingName", subEvent.getWingName());
        res.put("parentEventId", subEvent.getParentEventId());
        res.put("mainHeadId", subEvent.getMainHeadId());
        res.put("closureRequested", subEvent.getClosureRequested());
        res.put("facultyClosureApproved", subEvent.getFacultyClosureApproved());
        res.put("studentHeadClosureApproved", subEvent.getStudentHeadClosureApproved());
        res.put("principalClosureSanctioned", subEvent.getPrincipalClosureSanctioned());
        res.put("storekeeperClosureVerified", subEvent.getStorekeeperClosureVerified());
        res.put("facultyHeads", facultyHeads);
        res.put("coordinators", coordinators);

        return ResponseEntity.ok(res);
    }

    // POST /api/subevents - Create Sub-Event or Master Event (Wing)
    @PostMapping
    public ResponseEntity<?> createSubEvent(@RequestBody Map<String, Object> payload) {
        String name = (String) payload.getOrDefault("name", payload.get("subEventName"));
        String department = (String) payload.get("department");
        String description = (String) payload.getOrDefault("description", "");
        
        Double budgetCap = payload.get("budgetCap") != null 
                ? Double.valueOf(payload.get("budgetCap").toString()) 
                : (payload.get("allocatedBudget") != null ? Double.valueOf(payload.get("allocatedBudget").toString()) : 0.0);
        
        Double advanceDisbursed = payload.get("advanceDisbursed") != null 
                ? Double.valueOf(payload.get("advanceDisbursed").toString()) 
                : 0.0;

        String wingName = (String) payload.get("wingName");
        Long parentEventId = payload.get("parentEventId") != null ? Long.valueOf(payload.get("parentEventId").toString()) : null;
        Long mainHeadId = payload.get("mainHeadId") != null ? Long.valueOf(payload.get("mainHeadId").toString()) : null;

        SubEvent subEvent = new SubEvent(name, department, description, budgetCap, advanceDisbursed);
        subEvent.setWingName(wingName);
        subEvent.setParentEventId(parentEventId);
        subEvent.setMainHeadId(mainHeadId);

        SubEvent savedEvent = subEventRepository.save(subEvent);

        // Universal Coordinator ID Extraction (Supports List or Single ID / String or Number)
        Object coordPayload = payload.containsKey("coordinatorIds") ? payload.get("coordinatorIds") : payload.get("studentCoordinatorId");
        if (coordPayload != null) {
            List<Long> coordIds = new ArrayList<>();
            if (coordPayload instanceof List<?> list) {
                for (Object item : list) {
                    if (item != null && !item.toString().isBlank()) coordIds.add(Long.valueOf(item.toString()));
                }
            } else if (!coordPayload.toString().isBlank()) {
                coordIds.add(Long.valueOf(coordPayload.toString()));
            }

            for (Long cId : coordIds) {
                userRepository.findById(cId).ifPresent(u -> {
                    u.setAssignedSubEventId(savedEvent.getId());
                    userRepository.save(u);
                });
            }
        }

        // Universal Faculty ID Extraction (Supports List or Single ID / String or Number)
        Object facPayload = payload.containsKey("facultyIds") ? payload.get("facultyIds") : payload.get("facultyHeadId");
        if (facPayload != null) {
            List<Long> facIds = new ArrayList<>();
            if (facPayload instanceof List<?> list) {
                for (Object item : list) {
                    if (item != null && !item.toString().isBlank()) facIds.add(Long.valueOf(item.toString()));
                }
            } else if (!facPayload.toString().isBlank()) {
                facIds.add(Long.valueOf(facPayload.toString()));
            }

            for (Long fId : facIds) {
                userRepository.findById(fId).ifPresent(u -> {
                    u.setAssignedSubEventId(savedEvent.getId());
                    userRepository.save(u);
                });
            }
        }

        return ResponseEntity.ok(savedEvent);
    }

    // PUT /api/subevents/{id} - Edit Sub-Event & Reassign Leads
    @PutMapping("/{id}")
    public ResponseEntity<?> updateSubEvent(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        Optional<SubEvent> subEventOpt = subEventRepository.findById(id);
        if (subEventOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        SubEvent subEvent = subEventOpt.get();
        if (payload.containsKey("name")) subEvent.setName((String) payload.get("name"));
        else if (payload.containsKey("subEventName")) subEvent.setName((String) payload.get("subEventName"));
        
        if (payload.containsKey("department")) subEvent.setDepartment((String) payload.get("department"));
        if (payload.containsKey("description")) subEvent.setDescription((String) payload.get("description"));
        
        if (payload.containsKey("budgetCap") && payload.get("budgetCap") != null) {
            subEvent.setBudgetCap(Double.valueOf(payload.get("budgetCap").toString()));
        } else if (payload.containsKey("allocatedBudget") && payload.get("allocatedBudget") != null) {
            subEvent.setBudgetCap(Double.valueOf(payload.get("allocatedBudget").toString()));
        }
        
        if (payload.containsKey("advanceDisbursed") && payload.get("advanceDisbursed") != null) {
            subEvent.setAdvanceDisbursed(Double.valueOf(payload.get("advanceDisbursed").toString()));
        }
        if (payload.containsKey("wingName")) subEvent.setWingName((String) payload.get("wingName"));
        if (payload.containsKey("status")) subEvent.setStatus((String) payload.get("status"));
        
        if (payload.containsKey("parentEventId")) {
            Object pId = payload.get("parentEventId");
            subEvent.setParentEventId(pId != null && !pId.toString().isBlank() ? Long.valueOf(pId.toString()) : null);
        }
        if (payload.containsKey("mainHeadId")) {
            Object mId = payload.get("mainHeadId");
            subEvent.setMainHeadId(mId != null && !mId.toString().isBlank() ? Long.valueOf(mId.toString()) : null);
        }

        SubEvent updatedEvent = subEventRepository.save(subEvent);

        // Sync Student Coordinators Universally
        Object coordPayload = payload.containsKey("coordinatorIds") ? payload.get("coordinatorIds") : payload.get("studentCoordinatorId");
        if (coordPayload != null) {
            List<Long> coordIds = new ArrayList<>();
            if (coordPayload instanceof List<?> list) {
                for (Object item : list) {
                    if (item != null && !item.toString().isBlank()) coordIds.add(Long.valueOf(item.toString()));
                }
            } else if (!coordPayload.toString().isBlank()) {
                coordIds.add(Long.valueOf(coordPayload.toString()));
            }

            List<User> existingCoords = userRepository.findAll().stream()
                    .filter(u -> u.getRole() != null && 
                            (u.getRole().toUpperCase().contains("STUDENT") || u.getRole().toUpperCase().contains("COORDINATOR")) && 
                            id.equals(u.getAssignedSubEventId()))
                    .toList();

            for (User u : existingCoords) {
                if (!coordIds.contains(u.getId())) {
                    u.setAssignedSubEventId(null);
                    userRepository.save(u);
                }
            }
            for (Long cId : coordIds) {
                userRepository.findById(cId).ifPresent(u -> {
                    u.setAssignedSubEventId(updatedEvent.getId());
                    userRepository.save(u);
                });
            }
        }

        // Sync Faculty Heads Universally
        Object facPayload = payload.containsKey("facultyIds") ? payload.get("facultyIds") : payload.get("facultyHeadId");
        if (facPayload != null) {
            List<Long> facIds = new ArrayList<>();
            if (facPayload instanceof List<?> list) {
                for (Object item : list) {
                    if (item != null && !item.toString().isBlank()) facIds.add(Long.valueOf(item.toString()));
                }
            } else if (!facPayload.toString().isBlank()) {
                facIds.add(Long.valueOf(facPayload.toString()));
            }

            List<User> existingFac = userRepository.findAll().stream()
                    .filter(u -> u.getRole() != null && 
                            (u.getRole().toUpperCase().contains("FACULTY") || u.getRole().toUpperCase().contains("TEACHER")) && 
                            id.equals(u.getAssignedSubEventId()))
                    .toList();

            for (User u : existingFac) {
                if (!facIds.contains(u.getId())) {
                    u.setAssignedSubEventId(null);
                    userRepository.save(u);
                }
            }
            for (Long fId : facIds) {
                userRepository.findById(fId).ifPresent(u -> {
                    u.setAssignedSubEventId(updatedEvent.getId());
                    userRepository.save(u);
                });
            }
        }

        return ResponseEntity.ok(updatedEvent);
    }

    // PATCH /api/subevents/{id}/advance - Quick inline advance update
    @PatchMapping("/{id}/advance")
    public ResponseEntity<?> updateAdvance(@PathVariable Long id, @RequestBody Map<String, Double> payload) {
        Optional<SubEvent> subEventOpt = subEventRepository.findById(id);
        if (subEventOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Double newAdvance = payload.get("advanceDisbursed");
        if (newAdvance == null || newAdvance < 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "Valid advance amount is required."));
        }

        SubEvent subEvent = subEventOpt.get();
        subEvent.setAdvanceDisbursed(newAdvance);
        return ResponseEntity.ok(subEventRepository.save(subEvent));
    }

    // --- Macro Lifecycle: File Closure & Disbursement Pipeline ---

    @PostMapping("/{id}/request-closure")
    public ResponseEntity<?> requestClosure(@PathVariable Long id) {
        return subEventRepository.findById(id).map(subEvent -> {
            subEvent.setClosureRequested(true);
            subEvent.setStatus("CLOSURE_PENDING");
            SubEvent updated = subEventRepository.save(subEvent);
            return ResponseEntity.ok(updated);
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/verify-closure")
    public ResponseEntity<?> verifyClosure(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        String role = payload.get("role"); // "FACULTY" or "STUDENT_HEAD"
        
        return subEventRepository.findById(id).map(subEvent -> {
            if (role != null && role.toUpperCase().contains("FACULTY")) {
                subEvent.setFacultyClosureApproved(true);
            } else if (role != null && role.toUpperCase().contains("STUDENT_HEAD")) {
                subEvent.setStudentHeadClosureApproved(true);
            }

            if (Boolean.TRUE.equals(subEvent.getFacultyClosureApproved()) && 
                Boolean.TRUE.equals(subEvent.getStudentHeadClosureApproved())) {
                subEvent.setStatus("CLOSED");
            }

            SubEvent updated = subEventRepository.save(subEvent);
            return ResponseEntity.ok(updated);
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/sanction-closure")
    public ResponseEntity<?> sanctionClosure(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        String role = payload.get("role"); // "PRINCIPAL" or "STOREKEEPER"

        return subEventRepository.findById(id).map(subEvent -> {
            if (role != null && role.toUpperCase().contains("PRINCIPAL")) {
                subEvent.setPrincipalClosureSanctioned(true);
            } else if (role != null && role.toUpperCase().contains("STOREKEEPER")) {
                subEvent.setStorekeeperClosureVerified(true);
            }

            SubEvent updated = subEventRepository.save(subEvent);
            return ResponseEntity.ok(updated);
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/disburse")
    public ResponseEntity<?> disburseSubEvent(@PathVariable Long id) {
        return subEventRepository.findById(id).map(subEvent -> {
            double totalSpent = subEvent.getTotalSpent() != null ? subEvent.getTotalSpent() : 0.0;
            double advanceDisbursed = subEvent.getAdvanceDisbursed() != null ? subEvent.getAdvanceDisbursed() : 0.0;
            double netSettlement = totalSpent - advanceDisbursed;

            subEvent.setStatus("DISBURSED");
            SubEvent updated = subEventRepository.save(subEvent);

            Map<String, Object> response = new HashMap<>();
            response.put("subEvent", updated);
            response.put("netSettlement", netSettlement);
            response.put("message", "Payout calculated and executed successfully.");

            return ResponseEntity.ok(response);
        }).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/unassigned-users")
    public ResponseEntity<List<User>> getUnassignedUsers(@RequestParam String role, @RequestParam(required = false) String department) {
        List<User> users = userRepository.findAll().stream()
                .filter(u -> u.getRole() != null && u.getRole().toUpperCase().contains(role.toUpperCase()))
                .filter(u -> department == null || department.isEmpty() || (u.getDepartment() != null && u.getDepartment().equalsIgnoreCase(department)))
                .filter(u -> u.getAssignedSubEventId() == null)
                .toList();
        return ResponseEntity.ok(users);
    }

    @GetMapping("/{id}/candidates")
    public ResponseEntity<Map<String, List<User>>> getCandidates(
            @PathVariable Long id, 
            @RequestParam(required = false) String department) {
        List<User> users = userRepository.findAll();
        List<User> coords = users.stream()
                .filter(u -> u.getRole() != null && 
                        (u.getRole().toUpperCase().contains("STUDENT") || u.getRole().toUpperCase().contains("COORDINATOR")))
                .filter(u -> department == null || department.isEmpty() || (u.getDepartment() != null && department.equalsIgnoreCase(u.getDepartment())))
                .filter(u -> u.getAssignedSubEventId() == null || id.equals(u.getAssignedSubEventId()))
                .toList();
        List<User> faculty = users.stream()
                .filter(u -> u.getRole() != null && 
                        (u.getRole().toUpperCase().contains("FACULTY") || u.getRole().toUpperCase().contains("TEACHER")))
                .filter(u -> department == null || department.isEmpty() || (u.getDepartment() != null && department.equalsIgnoreCase(u.getDepartment())))
                .filter(u -> u.getAssignedSubEventId() == null || id.equals(u.getAssignedSubEventId()))
                .toList();

        Map<String, List<User>> responseMap = new HashMap<>();
        responseMap.put("coordinators", coords);
        responseMap.put("faculty", faculty);

        return ResponseEntity.ok(responseMap);
    }
}