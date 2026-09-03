package com.example.demo.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.entity.Bill;
import com.example.demo.repository.BillRepository;

@RestController
@RequestMapping("/api/bills")
@CrossOrigin(origins = "*")
public class BillController {

    @Autowired
    private BillRepository billRepository;

    @PostMapping
    public ResponseEntity<?> createBill(@RequestBody Bill newBill) {
        try {
            System.out.println("=== Incoming Bill Data ===");
            System.out.println("Vendor: " + newBill.getVendorName());
            System.out.println("Bill No: " + newBill.getBillNo());
            System.out.println("Amount: " + newBill.getAmount());

            // 1. Prevent crash on null amount
            if (newBill.getAmount() == null) {
                newBill.setAmount(0.0);
            }

            // 2. Duplicate Check
            if (newBill.getBillNo() != null && !newBill.getBillNo().equalsIgnoreCase("Unknown ID")) {
                List<Bill> all = billRepository.findAll();
                boolean exists = all.stream().anyMatch(b -> 
                    newBill.getBillNo().equalsIgnoreCase(b.getBillNo())
                );
                if (exists) {
                    System.out.println("⚠️ Rejection: Duplicate Bill Number detected.");
                    return ResponseEntity.badRequest().body("Error: Bill already exists.");
                }
            }

            // 3. Calculation Logic
            List<Bill> allBills = billRepository.findAll();
            Double prevTotal = 0.0;
            if (!allBills.isEmpty()) {
                Bill last = allBills.get(allBills.size() - 1);
                prevTotal = (last.getRunningTotal() != null) ? last.getRunningTotal() : 0.0;
            }
            newBill.setRunningTotal(prevTotal + newBill.getAmount());

            // 4. Final Save
            System.out.println("💾 Saving to database...");
            Bill saved = billRepository.save(newBill);
            System.out.println("✅ Save Successful!");
            return ResponseEntity.ok(saved);

        } catch (Exception e) {
            System.err.println("❌ JAVA CRASHED: " + e.getMessage());
            e.printStackTrace(); // This prints the full error stack trace
            return ResponseEntity.status(500).body("Internal Error: " + e.getMessage());
        }
    }

    @GetMapping
    public List<Bill> getAllBills() {
        return billRepository.findAll();
    }
    // Conveyor Belt Status Update (Faculty -> Storekeeper -> Principal)
    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateBillStatus(
            @PathVariable Long id,
            @RequestBody java.util.Map<String, String> payload) {

        java.util.Optional<com.example.demo.entity.Bill> billOpt = billRepository.findById(id);
        if (billOpt.isEmpty()) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.NOT_FOUND)
                    .body(java.util.Map.of("message", "Bill with ID " + id + " not found."));
        }

        com.example.demo.entity.Bill bill = billOpt.get();

        if (payload.containsKey("status")) {
            bill.setStatus(payload.get("status"));
        }

        if (payload.containsKey("remark") && payload.get("remark") != null && !payload.get("remark").isBlank()) {
            String remark = payload.get("remark");
            String existingDesc = bill.getDescription() != null ? bill.getDescription() : "";
            bill.setDescription((existingDesc + " | Audit Note: " + remark).trim());
        }

        com.example.demo.entity.Bill updatedBill = billRepository.save(bill);
        return ResponseEntity.ok(updatedBill);
    }
}