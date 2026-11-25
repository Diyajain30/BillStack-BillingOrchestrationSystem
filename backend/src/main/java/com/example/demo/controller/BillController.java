package com.example.demo.controller;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.entity.AuditLog;
import com.example.demo.entity.Bill;
import com.example.demo.entity.SubEvent;
import com.example.demo.repository.AuditLogRepository;
import com.example.demo.repository.BillRepository;
import com.example.demo.repository.SubEventRepository;

@RestController
@RequestMapping("/api/bills")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:5173"})
public class BillController {

    @Autowired
    private BillRepository billRepository;

    @Autowired
    private SubEventRepository subEventRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    private boolean canOverrideOcr(String role) {
        if (role == null) return false;
        String r = role.trim().toUpperCase();
        return "FACULTY".equals(r) || "FACULTY_HEAD".equals(r) || "MAIN_EVENT_HEAD".equals(r);
    }

    private Double parseDoubleSafe(Object val) {
        if (val == null || val.toString().trim().isEmpty()) return null;
        try {
            return Double.valueOf(val.toString().trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private boolean isSubEventOrParentClosed(Long subEventId) {
        if (subEventId == null) return false;
        Optional<SubEvent> subOpt = subEventRepository.findById(subEventId);
        if (subOpt.isEmpty()) return false;
        SubEvent sub = subOpt.get();
        if ("CLOSED".equalsIgnoreCase(sub.getStatus())) return true;
        if (sub.getParentEventId() != null) {
            return subEventRepository.findById(sub.getParentEventId())
                    .map(parent -> "CLOSED".equalsIgnoreCase(parent.getStatus()))
                    .orElse(false);
        }
        return false;
    }

    private String resolvePreviousStage(String currentStatus) {
        if (currentStatus == null) return "REJECTED";
        return switch (currentStatus.trim().toUpperCase()) {
            case "PENDING_STOREKEEPER" -> "PENDING_PRINCIPAL";
            case "PENDING_PRINCIPAL" -> "PENDING_MAIN_HEAD";
            case "PENDING_MAIN_HEAD" -> "PENDING_FACULTY";
            case "PENDING_FACULTY" -> "REJECTED";
            default -> "REJECTED";
        };
    }

    @GetMapping
    public ResponseEntity<List<Bill>> getAllBills(@RequestParam(required = false) Long subEventId) {
        List<Bill> all = billRepository.findAll();
        if (subEventId != null) {
            List<Bill> filtered = all.stream()
                    .filter(b -> subEventId.equals(b.getSubEventId()))
                    .toList();
            return ResponseEntity.ok(filtered);
        }
        return ResponseEntity.ok(all);
    }

    @PostMapping
    public ResponseEntity<?> createBill(@RequestBody Bill bill) {
        try {
            if (bill.getVendorName() == null || bill.getVendorName().isBlank() || bill.getAmount() == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("message", "Vendor name and amount are required."));
            }

            if (isSubEventOrParentClosed(bill.getSubEventId())) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(Map.of("message", "This event is CLOSED and read-only; no more bills can be submitted."));
            }

            if (bill.getBaseAmount() == null) bill.setBaseAmount(bill.getAmount());
            if (bill.getCgst() == null) bill.setCgst(0.0);
            if (bill.getSgst() == null) bill.setSgst(0.0);
            if (bill.getVendorGstin() == null || bill.getVendorGstin().isBlank()) {
                bill.setVendorGstin("Unregistered");
            }

            // Do not add pending bills to runningTotal or SubEvent totalSpent until fully APPROVED
            bill.setRunningTotal(0.0);

            String uploaderRole = bill.getUploadedByRole() != null
                    ? bill.getUploadedByRole().trim().toUpperCase()
                    : "STUDENT_COORDINATOR";
            bill.setUploadedByRole(uploaderRole);

            if (bill.getStatus() == null || bill.getStatus().isBlank()) {
                if ("STUDENT_HEAD".equals(uploaderRole)) {
                    bill.setStatus("PENDING_MAIN_HEAD");
                } else {
                    bill.setStatus("PENDING_FACULTY");
                }
            }

            Bill saved = billRepository.save(bill);

            try {
                AuditLog log = new AuditLog();
                log.setBillId(saved.getId());
                log.setRole(uploaderRole);
                log.setAction("STUDENT_HEAD".equals(uploaderRole)
                        ? "Bill Submitted (Routed to Main Event Head)"
                        : "Bill Submitted");
                log.setRemark(saved.getDescription() != null && !saved.getDescription().isBlank()
                        ? saved.getDescription()
                        : "Initial upload and OCR extraction.");
                log.setTimestamp(LocalDateTime.now());
                auditLogRepository.save(log);
            } catch (Exception logEx) {
                System.err.println("AuditLog write skipped: " + logEx.getMessage());
            }

            updateSubEventSpending(saved.getSubEventId());

            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Failed to save bill: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateBillStatus(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        Optional<Bill> billOpt = billRepository.findById(id);
        if (billOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Bill bill = billOpt.get();
        if (isSubEventOrParentClosed(bill.getSubEventId())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", "This event is CLOSED and read-only; no further changes are allowed."));
        }

        String actorRole = payload.containsKey("role") && payload.get("role") != null
                ? payload.get("role").toString().trim()
                : "SYSTEM";

        String remarkStr = "";
        if (payload.containsKey("remark") && payload.get("remark") != null) {
            remarkStr = payload.get("remark").toString().trim();
        }

        String targetStatus = payload.containsKey("status") && payload.get("status") != null
                ? payload.get("status").toString().trim()
                : "";

        boolean isRejection = "REJECTED".equalsIgnoreCase(targetStatus)
                || Boolean.TRUE.equals(payload.get("stepBack"));

        if (isRejection && remarkStr.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "A rejection remark is compulsory when rejecting a bill."));
        }

        if (canOverrideOcr(actorRole)) {
            if (payload.containsKey("vendorName") && payload.get("vendorName") != null) {
                bill.setVendorName(payload.get("vendorName").toString().trim());
            }
            if (payload.containsKey("billNo") && payload.get("billNo") != null) {
                bill.setBillNo(payload.get("billNo").toString().trim());
            }
            if (payload.containsKey("billDate") && payload.get("billDate") != null) {
                bill.setBillDate(payload.get("billDate").toString().trim());
            }
            if (payload.containsKey("vendorGstin") && payload.get("vendorGstin") != null) {
                bill.setVendorGstin(payload.get("vendorGstin").toString().trim());
            }
            if (payload.containsKey("receiptImage") && payload.get("receiptImage") != null
                    && !payload.get("receiptImage").toString().isBlank()) {
                bill.setReceiptImage(payload.get("receiptImage").toString());
            }
            Double amt = parseDoubleSafe(payload.get("amount"));
            if (amt != null) bill.setAmount(amt);
            Double base = parseDoubleSafe(payload.get("baseAmount"));
            if (base != null) bill.setBaseAmount(base);
            Double cgst = parseDoubleSafe(payload.get("cgst"));
            if (cgst != null) bill.setCgst(cgst);
            Double sgst = parseDoubleSafe(payload.get("sgst"));
            if (sgst != null) bill.setSgst(sgst);
        }

        String logAction = "Status updated";

        if (isRejection) {
            String prevStage = resolvePreviousStage(bill.getStatus());
            bill.setStatus(prevStage);
            bill.setRunningTotal(0.0);
            if (payload.containsKey("rejectionReason") && payload.get("rejectionReason") != null) {
                bill.setRejectionReason(payload.get("rejectionReason").toString());
            } else {
                bill.setRejectionReason(remarkStr);
            }
            bill.setRejectedBy(payload.containsKey("rejectedBy") && payload.get("rejectedBy") != null
                    ? payload.get("rejectedBy").toString()
                    : actorRole);
            logAction = "Rejected & stepped back to " + prevStage;
        } else if (!targetStatus.isEmpty()) {
            if ("APPROVED".equalsIgnoreCase(targetStatus)) {
                String currentStatus = bill.getStatus();
                if ("PENDING_FACULTY".equalsIgnoreCase(currentStatus)) {
                    bill.setStatus("PENDING_MAIN_HEAD");
                } else if ("PENDING_MAIN_HEAD".equalsIgnoreCase(currentStatus)) {
                    bill.setStatus("PENDING_PRINCIPAL");
                } else if ("PENDING_PRINCIPAL".equalsIgnoreCase(currentStatus)) {
                    bill.setStatus("PENDING_STOREKEEPER");
                } else if ("PENDING_STOREKEEPER".equalsIgnoreCase(currentStatus)) {
                    bill.setStatus("APPROVED");
                } else {
                    bill.setStatus("APPROVED");
                }
                bill.setRejectionReason(null);
                bill.setRejectedBy(null);
                logAction = "Approved & moved to " + bill.getStatus();
            } else {
                bill.setStatus(targetStatus);
                logAction = "Status updated to " + bill.getStatus();
            }
        }

        if (!remarkStr.isEmpty()) {
            String existingDesc = bill.getDescription() != null ? bill.getDescription() : "";
            bill.setDescription(existingDesc.isEmpty()
                    ? ("[" + actorRole + "] " + remarkStr)
                    : (existingDesc + " | [" + actorRole + "] " + remarkStr));
        }

        if ("APPROVED".equalsIgnoreCase(bill.getStatus()) && bill.getSubEventId() != null) {
            double previousApproved = billRepository.findAll().stream()
                    .filter(b -> bill.getSubEventId().equals(b.getSubEventId()))
                    .filter(b -> !bill.getId().equals(b.getId()))
                    .filter(b -> "APPROVED".equalsIgnoreCase(b.getStatus()))
                    .mapToDouble(b -> b.getAmount() != null ? b.getAmount() : 0.0)
                    .sum();
            bill.setRunningTotal(previousApproved + (bill.getAmount() != null ? bill.getAmount() : 0.0));
        }

        Bill updated = billRepository.save(bill);

        try {
            AuditLog log = new AuditLog();
            log.setBillId(updated.getId());
            log.setRole(actorRole);
            log.setAction(logAction);
            log.setRemark(remarkStr.isEmpty() ? "Status advanced in pipeline." : remarkStr);
            log.setTimestamp(LocalDateTime.now());
            auditLogRepository.save(log);
        } catch (Exception logEx) {
            System.err.println("AuditLog write skipped: " + logEx.getMessage());
        }

        updateSubEventSpending(updated.getSubEventId());

        return ResponseEntity.ok(updated);
    }

    @PutMapping("/{id}/reupload")
    public ResponseEntity<?> reuploadBill(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        Optional<Bill> billOpt = billRepository.findById(id);
        if (billOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Bill bill = billOpt.get();
        if (isSubEventOrParentClosed(bill.getSubEventId())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", "This event is CLOSED and read-only; no more bill changes are allowed."));
        }

        String remarkStr = payload.get("remark") != null ? payload.get("remark").toString().trim() : "";
        if (remarkStr.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "A resubmission remark is compulsory when re-uploading a bill."));
        }

        if (payload.get("vendorName") != null) bill.setVendorName(payload.get("vendorName").toString());
        if (payload.get("billNo") != null) bill.setBillNo(payload.get("billNo").toString());
        Double amt = parseDoubleSafe(payload.get("amount"));
        if (amt != null) bill.setAmount(amt);
        if (payload.get("billDate") != null) bill.setBillDate(payload.get("billDate").toString());
        if (payload.get("vendorGstin") != null) bill.setVendorGstin(payload.get("vendorGstin").toString());
        Double base = parseDoubleSafe(payload.get("baseAmount"));
        if (base != null) bill.setBaseAmount(base);
        Double cgst = parseDoubleSafe(payload.get("cgst"));
        if (cgst != null) bill.setCgst(cgst);
        Double sgst = parseDoubleSafe(payload.get("sgst"));
        if (sgst != null) bill.setSgst(sgst);
        if (payload.get("description") != null) bill.setDescription(payload.get("description").toString());
        if (payload.get("receiptImage") != null && !payload.get("receiptImage").toString().isBlank()) {
            bill.setReceiptImage(payload.get("receiptImage").toString());
        }

        bill.setStatus("PENDING_FACULTY");
        bill.setRunningTotal(0.0);
        bill.setRejectionReason(null);
        bill.setRejectedBy(null);

        Bill saved = billRepository.save(bill);

        try {
            AuditLog log = new AuditLog();
            log.setBillId(saved.getId());
            log.setRole("STUDENT_COORDINATOR");
            log.setAction("Bill Re-uploaded & Resubmitted");
            log.setRemark(remarkStr);
            log.setTimestamp(LocalDateTime.now());
            auditLogRepository.save(log);
        } catch (Exception logEx) {
            System.err.println("AuditLog write skipped: " + logEx.getMessage());
        }

        updateSubEventSpending(saved.getSubEventId());

        return ResponseEntity.ok(saved);
    }

    private void updateSubEventSpending(Long subEventId) {
        if (subEventId != null) {
            subEventRepository.findById(subEventId).ifPresent(se -> {
                double approvedSpent = billRepository.findAll().stream()
                        .filter(b -> subEventId.equals(b.getSubEventId()))
                        .filter(b -> "APPROVED".equalsIgnoreCase(b.getStatus()))
                        .mapToDouble(b -> b.getAmount() != null ? b.getAmount() : 0.0)
                        .sum();
                se.setTotalSpent(approvedSpent);
                subEventRepository.save(se);
            });
        }
    }
}