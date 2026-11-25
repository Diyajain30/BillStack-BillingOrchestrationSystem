package com.example.demo.controller;

import com.example.demo.entity.Bill;
import com.example.demo.entity.SubEvent;
import com.example.demo.entity.User;
import com.example.demo.repository.BillRepository;
import com.example.demo.repository.SubEventRepository;
import com.example.demo.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping({"/api/subevents", "/api/events"})
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:5173"})
public class SubEventController {

    private static final DateTimeFormatter DATE_FORMATTER =
            DateTimeFormatter.ofPattern("dd-MM-yyyy");

    @Autowired
    private SubEventRepository subEventRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BillRepository billRepository;

    private Double parseDoubleSafe(Object val, double fallback) {
        if (val == null || val.toString().trim().isEmpty()) return fallback;
        try {
            return Double.valueOf(val.toString().trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private Long parseLongSafe(Object val) {
        if (val == null || val.toString().trim().isEmpty()) return null;
        try {
            return Long.valueOf(val.toString().trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String normalizeIdCsv(Object raw) {
        if (raw == null) return "";
        if (raw instanceof List<?> list) {
            return list.stream()
                    .filter(Objects::nonNull)
                    .map(Object::toString)
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .distinct()
                    .collect(Collectors.joining(","));
        }
        return raw.toString().trim();
    }

    private Set<Long> parseIdSet(String csvIds) {
        Set<Long> result = new HashSet<>();
        if (csvIds == null || csvIds.trim().isEmpty()) return result;
        for (String part : csvIds.split(",")) {
            Long parsed = parseLongSafe(part);
            if (parsed != null) result.add(parsed);
        }
        return result;
    }

    private List<Long> extractUserIds(Object payloadObj) {
        List<Long> ids = new ArrayList<>();
        if (payloadObj == null) return ids;
        if (payloadObj instanceof List<?> list) {
            for (Object item : list) {
                Long parsed = parseLongSafe(item);
                if (parsed != null && !ids.contains(parsed)) ids.add(parsed);
            }
        } else {
            Long parsed = parseLongSafe(payloadObj);
            if (parsed != null) ids.add(parsed);
        }
        return ids;
    }

    private boolean isScopedHeadRole(String role) {
        if (role == null) return false;
        String r = role.trim().toUpperCase();
        return "MAIN_EVENT_HEAD".equals(r) || "STUDENT_HEAD".equals(r);
    }

    private boolean isStudentCoordinatorRole(String role) {
        if (role == null) return false;
        String r = role.trim().toUpperCase();
        return r.equals("STUDENT_COORDINATOR") || r.equals("STUDENT") || r.contains("COORDINATOR");
    }

    private boolean isFacultyRole(String role) {
        if (role == null) return false;
        String r = role.trim().toUpperCase();
        return r.equals("FACULTY") || r.contains("FACULTY") || r.contains("TEACHER");
    }

    private boolean isClosedStatus(String status) {
        return status != null && "CLOSED".equalsIgnoreCase(status.trim());
    }

    private boolean isParentClosed(SubEvent ev, List<SubEvent> allEvents) {
        if (ev == null || ev.getParentEventId() == null) return false;
        return allEvents.stream()
                .filter(p -> ev.getParentEventId().equals(p.getId()))
                .anyMatch(p -> isClosedStatus(p.getStatus()));
    }

    private boolean isAssignedToMasterEvent(SubEvent ev, Long userId) {
        if (ev == null || userId == null) return false;
        if (userId.equals(ev.getMainHeadId())) return true;
        if (parseIdSet(ev.getMainHeadIds()).contains(userId)) return true;
        return parseIdSet(ev.getStudentHeadIds()).contains(userId);
    }

    private Set<Long> getAssignedMasterEventIds(List<SubEvent> allEvents, Long userId) {
        return allEvents.stream()
                .filter(ev -> ev.getParentEventId() == null && isAssignedToMasterEvent(ev, userId))
                .map(SubEvent::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
    }

    private boolean canAccessEvent(SubEvent ev, Long userId, String role, Set<Long> assignedMasterIds) {
        if (!isScopedHeadRole(role)) return true;
        if (userId == null) return false;
        if (ev.getParentEventId() == null) return isAssignedToMasterEvent(ev, userId);
        return assignedMasterIds.contains(ev.getParentEventId());
    }

    private Set<Long> getBusyUserIdsInMasterEvent(Long parentEventId, Long excludeSubEventId) {
        Set<Long> busy = new HashSet<>();
        if (parentEventId == null) return busy;

        List<SubEvent> siblings = subEventRepository.findAll().stream()
                .filter(ev -> parentEventId.equals(ev.getParentEventId()))
                .filter(ev -> excludeSubEventId == null || !excludeSubEventId.equals(ev.getId()))
                .toList();

        Set<Long> siblingIds = new HashSet<>();
        for (SubEvent sibling : siblings) {
            if (sibling.getId() != null) siblingIds.add(sibling.getId());
            busy.addAll(parseIdSet(sibling.getCoordinatorIds()));
            busy.addAll(parseIdSet(sibling.getFacultyIds()));
        }

        if (!siblingIds.isEmpty()) {
            for (User u : userRepository.findAll()) {
                if (u.getAssignedSubEventId() != null && siblingIds.contains(u.getAssignedSubEventId())) {
                    busy.add(u.getId());
                }
            }
        }
        return busy;
    }

    private List<User> resolveAssignedUsers(SubEvent subEvent, boolean faculty) {
        Set<Long> explicitIds = parseIdSet(faculty ? subEvent.getFacultyIds() : subEvent.getCoordinatorIds());
        Long subEventId = subEvent.getId();
        return userRepository.findAll().stream()
                .filter(u -> faculty ? isFacultyRole(u.getRole()) : isStudentCoordinatorRole(u.getRole()))
                .filter(u -> explicitIds.contains(u.getId()) || (subEventId != null && subEventId.equals(u.getAssignedSubEventId())))
                .toList();
    }

    @GetMapping
    public ResponseEntity<?> getAllSubEvents(
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String role) {
        List<SubEvent> allEvents = subEventRepository.findAll();
        if (!isScopedHeadRole(role)) {
            return ResponseEntity.ok(allEvents);
        }
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "userId is required for scoped head access."));
        }

        Set<Long> assignedMasterIds = getAssignedMasterEventIds(allEvents, userId);
        List<SubEvent> scoped = allEvents.stream()
                .filter(ev -> canAccessEvent(ev, userId, role, assignedMasterIds))
                .toList();
        return ResponseEntity.ok(scoped);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getSubEventById(
            @PathVariable Long id,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String role) {
        Optional<SubEvent> subEventOpt = subEventRepository.findById(id);
        if (subEventOpt.isEmpty()) return ResponseEntity.notFound().build();

        SubEvent subEvent = subEventOpt.get();
        List<SubEvent> allEvents = subEventRepository.findAll();
        if (isScopedHeadRole(role)) {
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "userId is required for scoped head access."));
            }
            Set<Long> assignedMasterIds = getAssignedMasterEventIds(allEvents, userId);
            if (!canAccessEvent(subEvent, userId, role, assignedMasterIds)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "Access denied: event is outside your assigned Master Event scope."));
            }
        }

        List<User> facultyHeads = resolveAssignedUsers(subEvent, true);
        List<User> coordinators = resolveAssignedUsers(subEvent, false);
        boolean readOnly = isClosedStatus(subEvent.getStatus()) || isParentClosed(subEvent, allEvents);

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
        res.put("readOnly", readOnly);
        res.put("wingName", subEvent.getWingName());
        res.put("parentEventId", subEvent.getParentEventId());
        res.put("mainHeadId", subEvent.getMainHeadId());
        res.put("mainHeadIds", subEvent.getMainHeadIds());
        res.put("studentHeadIds", subEvent.getStudentHeadIds());
        res.put("coordinatorIds", subEvent.getCoordinatorIds());
        res.put("facultyIds", subEvent.getFacultyIds());
        res.put("createdDate", subEvent.getCreatedDate());
        res.put("eventYear", subEvent.getEventYear());
        res.put("closureRequested", subEvent.getClosureRequested());
        res.put("facultyClosureApproved", subEvent.getFacultyClosureApproved());
        res.put("studentHeadClosureApproved", subEvent.getStudentHeadClosureApproved());
        res.put("principalClosureSanctioned", subEvent.getPrincipalClosureSanctioned());
        res.put("storekeeperClosureVerified", subEvent.getStorekeeperClosureVerified());
        res.put("facultyHeads", facultyHeads);
        res.put("coordinators", coordinators);

        return ResponseEntity.ok(res);
    }

    @GetMapping("/available-leads")
    public ResponseEntity<Map<String, Object>> getAvailableLeadsForMasterEvent(
            @RequestParam Long parentEventId,
            @RequestParam(required = false) Long excludeSubEventId,
            @RequestParam(required = false) String department) {

        Set<Long> busyIds = getBusyUserIdsInMasterEvent(parentEventId, excludeSubEventId);
        boolean filterDept = department != null && !department.isBlank()
                && !"Institutional".equalsIgnoreCase(department.trim())
                && !"All".equalsIgnoreCase(department.trim());

        List<User> allUsers = userRepository.findAll();

        List<User> coords = allUsers.stream()
                .filter(u -> isStudentCoordinatorRole(u.getRole()))
                .filter(u -> !busyIds.contains(u.getId()))
                .filter(u -> !filterDept || (u.getDepartment() != null && u.getDepartment().equalsIgnoreCase(department.trim())))
                .toList();

        List<User> faculty = allUsers.stream()
                .filter(u -> isFacultyRole(u.getRole()))
                .filter(u -> !busyIds.contains(u.getId()))
                .filter(u -> !filterDept || (u.getDepartment() != null && u.getDepartment().equalsIgnoreCase(department.trim())))
                .toList();

        return ResponseEntity.ok(Map.of("coordinators", coords, "faculty", faculty));
    }

    @PostMapping
    public ResponseEntity<?> createSubEvent(@RequestBody Map<String, Object> payload) {
        try {
            Object rawName = payload.get("name") != null ? payload.get("name") : payload.get("subEventName");
            String name = rawName != null ? rawName.toString().trim() : "";
            if (name.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "Event name is required."));
            }

            List<SubEvent> allEvents = subEventRepository.findAll();
            Long parentEventId = parseLongSafe(payload.get("parentEventId"));
            if (parentEventId != null) {
                Optional<SubEvent> parentOpt = allEvents.stream()
                        .filter(ev -> parentEventId.equals(ev.getId()))
                        .findFirst();
                if (parentOpt.isPresent() && isClosedStatus(parentOpt.get().getStatus())) {
                    return ResponseEntity.status(HttpStatus.CONFLICT)
                            .body(Map.of("message", "Master Event is CLOSED and read-only; new sub-events cannot be added."));
                }
            }

            String department = payload.get("department") != null && !payload.get("department").toString().trim().isEmpty()
                    ? payload.get("department").toString().trim()
                    : null;
            String description = payload.get("description") != null ? payload.get("description").toString() : "";

            Object rawBudget = payload.get("budgetCap") != null ? payload.get("budgetCap") : payload.get("allocatedBudget");
            double budgetCap = parseDoubleSafe(rawBudget, 0.0);
            double advanceDisbursed = parseDoubleSafe(payload.get("advanceDisbursed"), 0.0);

            String wingName = payload.get("wingName") != null && !payload.get("wingName").toString().trim().isEmpty()
                    ? payload.get("wingName").toString().trim()
                    : null;

            List<Long> mainHeadIdList = extractUserIds(
                    payload.containsKey("mainHeadIds") ? payload.get("mainHeadIds") : payload.get("mainHeadId"));
            Long mainHeadId = parseLongSafe(payload.get("mainHeadId"));
            if (mainHeadId == null && !mainHeadIdList.isEmpty()) {
                mainHeadId = mainHeadIdList.get(0);
            }
            String mainHeadIdsCsv = normalizeIdCsv(
                    payload.containsKey("mainHeadIds") ? payload.get("mainHeadIds") : mainHeadIdList);
            String studentHeadIds = normalizeIdCsv(payload.get("studentHeadIds"));

            String actorRole = payload.get("actorRole") != null ? payload.get("actorRole").toString() : null;
            Long actorUserId = parseLongSafe(payload.get("actorUserId"));

            if (isScopedHeadRole(actorRole)) {
                if (actorUserId == null) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(Map.of("message", "actorUserId is required for scoped head creation."));
                }
                if (parentEventId == null) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(Map.of("message", "Student Heads can only create sub-events under an assigned Master Event."));
                }
                Set<Long> assignedMasterIds = getAssignedMasterEventIds(allEvents, actorUserId);
                if (!assignedMasterIds.contains(parentEventId)) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(Map.of("message", "Access denied: parent Master Event is not assigned to you."));
                }
            }

            List<Long> coordIds = extractUserIds(
                    payload.containsKey("coordinatorIds") ? payload.get("coordinatorIds") : payload.get("studentCoordinatorId"));
            List<Long> facIds = extractUserIds(
                    payload.containsKey("facultyIds") ? payload.get("facultyIds") : payload.get("facultyHeadId"));

            if (parentEventId != null && (!coordIds.isEmpty() || !facIds.isEmpty())) {
                Set<Long> busyIds = getBusyUserIdsInMasterEvent(parentEventId, null);
                List<Long> conflicts = new ArrayList<>();
                for (Long cId : coordIds) if (busyIds.contains(cId)) conflicts.add(cId);
                for (Long fId : facIds) if (busyIds.contains(fId)) conflicts.add(fId);

                if (!conflicts.isEmpty()) {
                    String names = userRepository.findAllById(conflicts).stream()
                            .map(u -> u.getName() != null ? u.getName() : u.getUsername())
                            .collect(Collectors.joining(", "));
                    return ResponseEntity.badRequest().body(Map.of(
                            "message", "Already assigned to another sub-event in this Master Event: " + names));
                }
            }

            LocalDate today = LocalDate.now();
            String formattedDate = (payload.get("createdDate") != null && !payload.get("createdDate").toString().trim().isEmpty())
                    ? payload.get("createdDate").toString().trim()
                    : today.format(DATE_FORMATTER);
            Long parsedYear = parseLongSafe(payload.get("eventYear"));
            Integer eventYear = parsedYear != null ? parsedYear.intValue() : today.getYear();

            SubEvent subEvent = new SubEvent(name, department, description, budgetCap, advanceDisbursed);
            subEvent.setWingName(wingName);
            subEvent.setParentEventId(parentEventId);
            subEvent.setMainHeadId(mainHeadId);
            subEvent.setMainHeadIds(mainHeadIdsCsv);
            subEvent.setStudentHeadIds(studentHeadIds);
            subEvent.setCoordinatorIds(normalizeIdCsv(coordIds));
            subEvent.setFacultyIds(normalizeIdCsv(facIds));
            subEvent.setCreatedDate(formattedDate);
            subEvent.setEventYear(eventYear);
            if (payload.get("status") != null && !payload.get("status").toString().trim().isEmpty()) {
                subEvent.setStatus(payload.get("status").toString().trim());
            }

            SubEvent savedEvent = subEventRepository.save(subEvent);

            for (Long cId : coordIds) {
                userRepository.findById(cId).ifPresent(u -> {
                    u.setAssignedSubEventId(savedEvent.getId());
                    userRepository.save(u);
                });
            }
            for (Long fId : facIds) {
                userRepository.findById(fId).ifPresent(u -> {
                    u.setAssignedSubEventId(savedEvent.getId());
                    userRepository.save(u);
                });
            }

            return ResponseEntity.status(HttpStatus.CREATED).body(savedEvent);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Failed to create event: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateSubEvent(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        try {
            Optional<SubEvent> subEventOpt = subEventRepository.findById(id);
            if (subEventOpt.isEmpty()) return ResponseEntity.notFound().build();

            SubEvent subEvent = subEventOpt.get();
            List<SubEvent> allEvents = subEventRepository.findAll();

            if (isClosedStatus(subEvent.getStatus()) || isParentClosed(subEvent, allEvents)) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(Map.of("message", "This event is CLOSED and read-only; no further changes are allowed."));
            }

            String actorRole = payload.get("actorRole") != null ? payload.get("actorRole").toString() : null;
            Long actorUserId = parseLongSafe(payload.get("actorUserId"));

            if (isScopedHeadRole(actorRole)) {
                if (actorUserId == null) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(Map.of("message", "actorUserId is required for scoped head updates."));
                }
                Set<Long> assignedMasterIds = getAssignedMasterEventIds(allEvents, actorUserId);
                if (!canAccessEvent(subEvent, actorUserId, actorRole, assignedMasterIds)) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(Map.of("message", "Access denied: event is outside your assigned Master Event scope."));
                }
            }

            if (payload.containsKey("name") && payload.get("name") != null) {
                subEvent.setName(payload.get("name").toString().trim());
            } else if (payload.containsKey("subEventName") && payload.get("subEventName") != null) {
                subEvent.setName(payload.get("subEventName").toString().trim());
            }
            if (payload.containsKey("department")) {
                subEvent.setDepartment(payload.get("department") != null ? payload.get("department").toString().trim() : null);
            }
            if (payload.containsKey("description")) {
                subEvent.setDescription(payload.get("description") != null ? payload.get("description").toString() : "");
            }
            if (payload.containsKey("budgetCap") && payload.get("budgetCap") != null && !payload.get("budgetCap").toString().trim().isEmpty()) {
                subEvent.setBudgetCap(parseDoubleSafe(payload.get("budgetCap"), subEvent.getBudgetCap() != null ? subEvent.getBudgetCap() : 0.0));
            } else if (payload.containsKey("allocatedBudget") && payload.get("allocatedBudget") != null && !payload.get("allocatedBudget").toString().trim().isEmpty()) {
                subEvent.setBudgetCap(parseDoubleSafe(payload.get("allocatedBudget"), subEvent.getBudgetCap() != null ? subEvent.getBudgetCap() : 0.0));
            }
            if (payload.containsKey("advanceDisbursed") && payload.get("advanceDisbursed") != null && !payload.get("advanceDisbursed").toString().trim().isEmpty()) {
                subEvent.setAdvanceDisbursed(parseDoubleSafe(payload.get("advanceDisbursed"), subEvent.getAdvanceDisbursed() != null ? subEvent.getAdvanceDisbursed() : 0.0));
            }
            if (payload.containsKey("wingName")) {
                subEvent.setWingName(payload.get("wingName") != null ? payload.get("wingName").toString().trim() : null);
            }
            if (payload.containsKey("status") && payload.get("status") != null && !payload.get("status").toString().trim().isEmpty()) {
                String requestedStatus = payload.get("status").toString().trim().toUpperCase();
                if ("CLOSED".equals(requestedStatus) && subEvent.getParentEventId() == null) {
                    ResponseEntity<?> closeCheck = closeMasterEventInternal(subEvent, allEvents);
                    if (closeCheck.getStatusCode() != HttpStatus.OK) return closeCheck;
                } else {
                    subEvent.setStatus(requestedStatus);
                }
            }
            if (payload.containsKey("parentEventId")) {
                subEvent.setParentEventId(parseLongSafe(payload.get("parentEventId")));
            }
            if (payload.containsKey("mainHeadId")) {
                subEvent.setMainHeadId(parseLongSafe(payload.get("mainHeadId")));
            }
            if (payload.containsKey("mainHeadIds")) {
                String normalizedMainHeads = normalizeIdCsv(payload.get("mainHeadIds"));
                subEvent.setMainHeadIds(normalizedMainHeads);
                if (!payload.containsKey("mainHeadId")) {
                    List<Long> ids = extractUserIds(payload.get("mainHeadIds"));
                    subEvent.setMainHeadId(ids.isEmpty() ? null : ids.get(0));
                }
            }
            if (payload.containsKey("studentHeadIds")) {
                subEvent.setStudentHeadIds(normalizeIdCsv(payload.get("studentHeadIds")));
            }
            if (payload.containsKey("createdDate") && payload.get("createdDate") != null && !payload.get("createdDate").toString().trim().isEmpty()) {
                subEvent.setCreatedDate(payload.get("createdDate").toString().trim());
            }
            if (payload.containsKey("eventYear")) {
                Long parsedYear = parseLongSafe(payload.get("eventYear"));
                if (parsedYear != null) subEvent.setEventYear(parsedYear.intValue());
            }

            Object coordPayload = payload.containsKey("coordinatorIds") ? payload.get("coordinatorIds") : payload.get("studentCoordinatorId");
            Object facPayload = payload.containsKey("facultyIds") ? payload.get("facultyIds") : payload.get("facultyHeadId");

            List<Long> coordIds = coordPayload != null ? extractUserIds(coordPayload) : null;
            List<Long> facIds = facPayload != null ? extractUserIds(facPayload) : null;

            if (subEvent.getParentEventId() != null) {
                Set<Long> busyIds = getBusyUserIdsInMasterEvent(subEvent.getParentEventId(), id);
                List<Long> conflicts = new ArrayList<>();
                if (coordIds != null) {
                    for (Long cId : coordIds) if (busyIds.contains(cId)) conflicts.add(cId);
                }
                if (facIds != null) {
                    for (Long fId : facIds) if (busyIds.contains(fId)) conflicts.add(fId);
                }
                if (!conflicts.isEmpty()) {
                    String names = userRepository.findAllById(conflicts).stream()
                            .map(u -> u.getName() != null ? u.getName() : u.getUsername())
                            .collect(Collectors.joining(", "));
                    return ResponseEntity.badRequest().body(Map.of(
                            "message", "Already assigned to another sub-event in this Master Event: " + names));
                }
            }

            if (coordIds != null) {
                Set<Long> prevCoords = parseIdSet(subEvent.getCoordinatorIds());
                subEvent.setCoordinatorIds(normalizeIdCsv(coordIds));
                for (Long oldId : prevCoords) {
                    if (!coordIds.contains(oldId)) {
                        userRepository.findById(oldId).ifPresent(u -> {
                            if (id.equals(u.getAssignedSubEventId())) {
                                u.setAssignedSubEventId(null);
                                userRepository.save(u);
                            }
                        });
                    }
                }
                for (Long cId : coordIds) {
                    userRepository.findById(cId).ifPresent(u -> {
                        u.setAssignedSubEventId(id);
                        userRepository.save(u);
                    });
                }
            }

            if (facIds != null) {
                Set<Long> prevFac = parseIdSet(subEvent.getFacultyIds());
                subEvent.setFacultyIds(normalizeIdCsv(facIds));
                for (Long oldId : prevFac) {
                    if (!facIds.contains(oldId)) {
                        userRepository.findById(oldId).ifPresent(u -> {
                            if (id.equals(u.getAssignedSubEventId())) {
                                u.setAssignedSubEventId(null);
                                userRepository.save(u);
                            }
                        });
                    }
                }
                for (Long fId : facIds) {
                    userRepository.findById(fId).ifPresent(u -> {
                        u.setAssignedSubEventId(id);
                        userRepository.save(u);
                    });
                }
            }

            SubEvent updatedEvent = subEventRepository.save(subEvent);
            return ResponseEntity.ok(updatedEvent);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Failed to update event: " + e.getMessage()));
        }
    }

    @PatchMapping("/{id}/advance")
    public ResponseEntity<?> updateAdvance(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        Optional<SubEvent> subEventOpt = subEventRepository.findById(id);
        if (subEventOpt.isEmpty()) return ResponseEntity.notFound().build();

        SubEvent subEvent = subEventOpt.get();
        List<SubEvent> allEvents = subEventRepository.findAll();
        if (isClosedStatus(subEvent.getStatus()) || isParentClosed(subEvent, allEvents)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", "This event is CLOSED and read-only."));
        }

        String actorRole = payload.get("actorRole") != null ? payload.get("actorRole").toString() : null;
        Long actorUserId = parseLongSafe(payload.get("actorUserId"));
        if (isScopedHeadRole(actorRole)) {
            if (actorUserId == null) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "actorUserId is required for scoped head advance updates."));
            }
            Set<Long> assignedMasterIds = getAssignedMasterEventIds(allEvents, actorUserId);
            if (!canAccessEvent(subEvent, actorUserId, actorRole, assignedMasterIds)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "Access denied: event is outside your assigned Master Event scope."));
            }
        }

        Double newAdvance = parseDoubleSafe(payload.get("advanceDisbursed"), -1.0);
        if (newAdvance < 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "Valid advance amount is required."));
        }

        subEvent.setAdvanceDisbursed(newAdvance);
        return ResponseEntity.ok(subEventRepository.save(subEvent));
    }

    @PostMapping("/{id}/request-closure")
    public ResponseEntity<?> requestClosure(@PathVariable Long id) {
        return subEventRepository.findById(id).map(subEvent -> {
            if (isClosedStatus(subEvent.getStatus())) {
                return ResponseEntity.ok(subEvent);
            }
            List<Bill> subBills = billRepository.findAll().stream()
                    .filter(b -> id.equals(b.getSubEventId()))
                    .toList();
            boolean hasUnapproved = subBills.stream()
                    .anyMatch(b -> !"APPROVED".equalsIgnoreCase(b.getStatus()));
            if (hasUnapproved) {
                return ResponseEntity.badRequest().body(Map.of(
                        "message", "All bills in this sub-event must be approved before requesting closure."));
            }
            subEvent.setClosureRequested(true);
            subEvent.setStatus("CLOSURE_PENDING");
            return ResponseEntity.ok(subEventRepository.save(subEvent));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/verify-closure")
    public ResponseEntity<?> verifyClosure(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        String role = payload.get("role");
        Long userId = parseLongSafe(payload.get("userId"));
        return subEventRepository.findById(id).map(subEvent -> {
            if (isClosedStatus(subEvent.getStatus())) {
                return ResponseEntity.ok(subEvent);
            }
            if (isScopedHeadRole(role)) {
                if (userId == null) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(Map.of("message", "userId is required for scoped head closure verification."));
                }
                Set<Long> assignedMasterIds = getAssignedMasterEventIds(subEventRepository.findAll(), userId);
                if (!canAccessEvent(subEvent, userId, role, assignedMasterIds)) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(Map.of("message", "Access denied: event is outside your assigned Master Event scope."));
                }
            }

            if (role != null && role.toUpperCase().contains("FACULTY")) {
                subEvent.setFacultyClosureApproved(true);
            } else if (role != null && role.toUpperCase().contains("STUDENT_HEAD")) {
                subEvent.setStudentHeadClosureApproved(true);
            }

            if (Boolean.TRUE.equals(subEvent.getFacultyClosureApproved()) &&
                Boolean.TRUE.equals(subEvent.getStudentHeadClosureApproved())) {
                subEvent.setStatus("CLOSED");
            }

            return ResponseEntity.ok(subEventRepository.save(subEvent));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/close-master")
    public ResponseEntity<?> closeMasterEvent(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> payload) {
        Optional<SubEvent> masterOpt = subEventRepository.findById(id);
        if (masterOpt.isEmpty()) return ResponseEntity.notFound().build();

        SubEvent master = masterOpt.get();
        if (master.getParentEventId() != null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Event is not a Master Event."));
        }

        Long userId = payload != null ? parseLongSafe(payload.get("userId")) : null;
        String role = payload != null && payload.get("role") != null ? payload.get("role").toString() : "MAIN_EVENT_HEAD";
        List<SubEvent> allEvents = subEventRepository.findAll();

        if (isScopedHeadRole(role)) {
            if (userId == null || !isAssignedToMasterEvent(master, userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "Access denied: Master Event is not assigned to you."));
            }
        }

        return closeMasterEventInternal(master, allEvents);
    }

    private ResponseEntity<?> closeMasterEventInternal(SubEvent master, List<SubEvent> allEvents) {
        List<SubEvent> children = allEvents.stream()
                .filter(ev -> master.getId().equals(ev.getParentEventId()))
                .toList();

        Set<Long> childIds = children.stream()
                .map(SubEvent::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        boolean anyBillNotApproved = billRepository.findAll().stream()
                .filter(b -> b.getSubEventId() != null && childIds.contains(b.getSubEventId()))
                .anyMatch(b -> !"APPROVED".equalsIgnoreCase(b.getStatus()));

        if (anyBillNotApproved) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message", "All bills across all sub-events in this Master Event must be approved before closing."));
        }

        for (SubEvent child : children) {
            child.setClosureRequested(true);
            child.setFacultyClosureApproved(true);
            child.setStudentHeadClosureApproved(true);
            child.setStatus("CLOSED");
            subEventRepository.save(child);
        }

        master.setStatus("CLOSED");
        SubEvent savedMaster = subEventRepository.save(master);
        return ResponseEntity.ok(savedMaster);
    }

    @PutMapping("/{id}/sanction-closure")
    public ResponseEntity<?> sanctionClosure(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        String role = payload.get("role");
        return subEventRepository.findById(id).map(subEvent -> {
            if (role != null && role.toUpperCase().contains("PRINCIPAL")) {
                subEvent.setPrincipalClosureSanctioned(true);
            } else if (role != null && role.toUpperCase().contains("STOREKEEPER")) {
                subEvent.setStorekeeperClosureVerified(true);
            }
            return ResponseEntity.ok(subEventRepository.save(subEvent));
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

    @GetMapping("/{id}/candidates")
    public ResponseEntity<?> getCandidates(
            @PathVariable Long id,
            @RequestParam(required = false) String department) {
        Optional<SubEvent> subEventOpt = subEventRepository.findById(id);
        Long parentEventId = subEventOpt.map(SubEvent::getParentEventId).orElse(null);

        if (parentEventId != null) {
            return getAvailableLeadsForMasterEvent(parentEventId, id, department);
        }

        List<User> users = userRepository.findAll();
        List<User> coords = users.stream()
                .filter(u -> isStudentCoordinatorRole(u.getRole()))
                .filter(u -> u.getAssignedSubEventId() == null || id.equals(u.getAssignedSubEventId()))
                .toList();
        List<User> faculty = users.stream()
                .filter(u -> isFacultyRole(u.getRole()))
                .filter(u -> u.getAssignedSubEventId() == null || id.equals(u.getAssignedSubEventId()))
                .toList();

        return ResponseEntity.ok(Map.of("coordinators", coords, "faculty", faculty));
    }
}