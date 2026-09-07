package com.example.demo.controller;

import com.example.demo.entity.SubEvent;
import com.example.demo.entity.User;
import com.example.demo.repository.SubEventRepository;
import com.example.demo.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/subevents")
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
                .filter(u -> "FACULTY".equalsIgnoreCase(u.getRole()) && id.equals(u.getAssignedSubEventId()))
                .toList();
        List<User> coordinators = userRepository.findAll().stream()
                .filter(u -> "STUDENT_COORDINATOR".equalsIgnoreCase(u.getRole()) && id.equals(u.getAssignedSubEventId()))
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
        res.put("facultyHeads", facultyHeads);
        res.put("coordinators", coordinators);

        return ResponseEntity.ok(res);
    }

    // POST /api/subevents - Create Sub-Event
    @PostMapping
    public ResponseEntity<?> createSubEvent(@RequestBody Map<String, Object> payload) {
        String name = (String) payload.get("name");
        String department = (String) payload.get("department");
        String description = (String) payload.get("description");
        Double budgetCap = Double.valueOf(payload.get("budgetCap").toString());
        Double advanceDisbursed = payload.get("advanceDisbursed") != null 
                ? Double.valueOf(payload.get("advanceDisbursed").toString()) 
                : 0.0;

        SubEvent subEvent = new SubEvent(name, department, description, budgetCap, advanceDisbursed);
        SubEvent savedEvent = subEventRepository.save(subEvent);

        if (payload.get("coordinatorIds") instanceof List<?> coordIds) {
            for (Object idObj : coordIds) {
                Long userId = Long.valueOf(idObj.toString());
                userRepository.findById(userId).ifPresent(u -> {
                    u.setAssignedSubEventId(savedEvent.getId());
                    userRepository.save(u);
                });
            }
        }

        if (payload.get("facultyIds") instanceof List<?> facIds) {
            for (Object idObj : facIds) {
                Long userId = Long.valueOf(idObj.toString());
                userRepository.findById(userId).ifPresent(u -> {
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
        if (payload.containsKey("department")) subEvent.setDepartment((String) payload.get("department"));
        if (payload.containsKey("description")) subEvent.setDescription((String) payload.get("description"));
        if (payload.containsKey("budgetCap")) subEvent.setBudgetCap(Double.valueOf(payload.get("budgetCap").toString()));
        if (payload.containsKey("advanceDisbursed")) subEvent.setAdvanceDisbursed(Double.valueOf(payload.get("advanceDisbursed").toString()));

        SubEvent updatedEvent = subEventRepository.save(subEvent);

        // Sync Student Coordinators
        if (payload.containsKey("coordinatorIds")) {
            List<?> coordIds = (List<?>) payload.get("coordinatorIds");
            List<User> existingCoords = userRepository.findAll().stream()
                    .filter(u -> "STUDENT_COORDINATOR".equalsIgnoreCase(u.getRole()) && id.equals(u.getAssignedSubEventId()))
                    .toList();

            for (User u : existingCoords) {
                if (!coordIds.contains(u.getId())) {
                    u.setAssignedSubEventId(null);
                    userRepository.save(u);
                }
            }
            for (Object cId : coordIds) {
                Long uId = Long.valueOf(cId.toString());
                userRepository.findById(uId).ifPresent(u -> {
                    u.setAssignedSubEventId(updatedEvent.getId());
                    userRepository.save(u);
                });
            }
        }

        // Sync Faculty Heads
        if (payload.containsKey("facultyIds")) {
            List<?> facIds = (List<?>) payload.get("facultyIds");
            List<User> existingFac = userRepository.findAll().stream()
                    .filter(u -> "FACULTY".equalsIgnoreCase(u.getRole()) && id.equals(u.getAssignedSubEventId()))
                    .toList();

            for (User u : existingFac) {
                if (!facIds.contains(u.getId())) {
                    u.setAssignedSubEventId(null);
                    userRepository.save(u);
                }
            }
            for (Object fId : facIds) {
                Long uId = Long.valueOf(fId.toString());
                userRepository.findById(uId).ifPresent(u -> {
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

    // GET /api/subevents/unassigned-users - For creation dropdowns
    @GetMapping("/unassigned-users")
    public ResponseEntity<List<User>> getUnassignedUsers(@RequestParam String role, @RequestParam String department) {
        List<User> users = userRepository.findAll().stream()
                .filter(u -> u.getRole().equalsIgnoreCase(role))
                .filter(u -> department == null || department.isEmpty() || u.getDepartment().equalsIgnoreCase(department))
                .filter(u -> u.getAssignedSubEventId() == null)
                .toList();
        return ResponseEntity.ok(users);
    }

    // GET /api/subevents/{id}/candidates - For editing dropdowns (current assignees + available unassigned)
    @GetMapping("/{id}/candidates")
    public ResponseEntity<Map<String, List<User>>> getCandidates(
            @PathVariable Long id, 
            @RequestParam(required = false) String department) {
        List<User> users = userRepository.findAll();
        List<User> coords = users.stream()
                .filter(u -> "STUDENT_COORDINATOR".equalsIgnoreCase(u.getRole()))
                .filter(u -> department == null || department.isEmpty() || department.equalsIgnoreCase(u.getDepartment()))
                .filter(u -> u.getAssignedSubEventId() == null || id.equals(u.getAssignedSubEventId()))
                .toList();
        List<User> faculty = users.stream()
                .filter(u -> "FACULTY".equalsIgnoreCase(u.getRole()))
                .filter(u -> department == null || department.isEmpty() || department.equalsIgnoreCase(u.getDepartment()))
                .filter(u -> u.getAssignedSubEventId() == null || id.equals(u.getAssignedSubEventId()))
                .toList();

        return ResponseEntity.ok(Map.of("coordinators", coords, "faculty", faculty));
    }
}