package com.example.demo.controller;

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

import com.example.demo.entity.Bill;
import com.example.demo.repository.BillRepository;
import com.example.demo.repository.SubEventRepository;

@RestController
@RequestMapping("/api/bills")
@CrossOrigin(origins = "http://localhost:3000")
public class BillController {

    @Autowired
    private BillRepository billRepository;

    @Autowired
    private SubEventRepository subEventRepository;

    // GET /api/bills - Scoped by subEventId query param
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

    // POST /api/bills - Attach subEventId and compute folder-specific running total
    @PostMapping
    public ResponseEntity<?> createBill(@RequestBody Bill bill) {
        if (bill.getVendorName() == null || bill.getAmount() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Vendor name and amount are required."));
        }

        // Calculate running total strictly within this sub-event folder
        List<Bill> existing = billRepository.findAll();
        double folderRunningTotal = existing.stream()
                .filter(b -> bill.getSubEventId() != null && bill.getSubEventId().equals(b.getSubEventId()))
                .mapToDouble(b -> b.getAmount() != null ? b.getAmount() : 0.0)
                .sum();
        bill.setRunningTotal(folderRunningTotal + bill.getAmount());

        if (bill.getStatus() == null || bill.getStatus().isBlank()) {
            bill.setStatus("PENDING_FACULTY");
        }

        Bill saved = billRepository.save(bill);

        // Update SubEvent totalSpent
        updateSubEventSpending(saved.getSubEventId());

        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    // PUT /api/bills/{id}/status - Update bill status through approval pipeline or handle rejections
    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateBillStatus(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        Optional<Bill> billOpt = billRepository.findById(id);
        if (billOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Bill bill = billOpt.get();

        if (payload.containsKey("status")) {
            String targetStatus = (String) payload.get("status");

            if ("REJECTED".equalsIgnoreCase(targetStatus)) {
                bill.setStatus("REJECTED");
                if (payload.containsKey("rejectionReason")) {
                    bill.setRejectionReason((String) payload.get("rejectionReason"));
                }
                if (payload.containsKey("rejectedBy")) {
                    bill.setRejectedBy((String) payload.get("rejectedBy"));
                }
            } else if ("APPROVED".equalsIgnoreCase(targetStatus)) {
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
            } else {
                bill.setStatus(targetStatus);
            }
        }

        // Editable fields sync (supports manual OCR overrides during review gates)
        if (payload.containsKey("vendorName")) bill.setVendorName((String) payload.get("vendorName"));
        if (payload.containsKey("billNo")) bill.setBillNo((String) payload.get("billNo"));
        if (payload.containsKey("billDate")) bill.setBillDate((String) payload.get("billDate"));
        if (payload.containsKey("vendorGstin")) bill.setVendorGstin((String) payload.get("vendorGstin"));
        if (payload.containsKey("amount")) bill.setAmount(Double.valueOf(payload.get("amount").toString()));
        if (payload.containsKey("baseAmount")) bill.setBaseAmount(Double.valueOf(payload.get("baseAmount").toString()));
        if (payload.containsKey("cgst")) bill.setCgst(Double.valueOf(payload.get("cgst").toString()));
        if (payload.containsKey("sgst")) bill.setSgst(Double.valueOf(payload.get("sgst").toString()));

        if (payload.containsKey("remark")) {
            String remark = (String) payload.get("remark");
            String existingDesc = bill.getDescription() != null ? bill.getDescription() : "";
            bill.setDescription(existingDesc + " | Note: " + remark);
        }

        Bill updated = billRepository.save(bill);

        // Recalculate SubEvent totalSpent
        updateSubEventSpending(updated.getSubEventId());

        return ResponseEntity.ok(updated);
    }

    // PUT /api/bills/{id}/reupload - Student re-uploads/corrects a rejected bill
    @PutMapping("/{id}/reupload")
    public ResponseEntity<?> reuploadBill(@PathVariable Long id, @RequestBody Bill updatedData) {
        Optional<Bill> billOpt = billRepository.findById(id);
        if (billOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Bill bill = billOpt.get();

        // Update details with re-uploaded info
        if (updatedData.getVendorName() != null) bill.setVendorName(updatedData.getVendorName());
        if (updatedData.getBillNo() != null) bill.setBillNo(updatedData.getBillNo());
        if (updatedData.getAmount() != null) bill.setAmount(updatedData.getAmount());
        if (updatedData.getBillDate() != null) bill.setBillDate(updatedData.getBillDate());
       // if (updatedData.getBillImageUrl() != null) bill.setBillImageUrl(updatedData.getBillImageUrl());

        // Reset pipeline state back to Faculty review and clear rejection info
        bill.setStatus("PENDING_FACULTY");
        bill.setRejectionReason(null);
        bill.setRejectedBy(null);

        Bill saved = billRepository.save(bill);
        updateSubEventSpending(saved.getSubEventId());

        return ResponseEntity.ok(saved);
    }

    // Helper method to recalculate sub-event spending
    private void updateSubEventSpending(Long subEventId) {
        if (subEventId != null) {
            subEventRepository.findById(subEventId).ifPresent(se -> {
                double spent = billRepository.findAll().stream()
                        .filter(b -> subEventId.equals(b.getSubEventId()))
                        .filter(b -> !"REJECTED".equalsIgnoreCase(b.getStatus()))
                        .mapToDouble(b -> b.getAmount() != null ? b.getAmount() : 0.0)
                        .sum();
                se.setTotalSpent(spent);
                subEventRepository.save(se);
            });
        }
    }
}