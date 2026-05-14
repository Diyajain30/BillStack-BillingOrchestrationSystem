package com.example.demo.controller;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
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

    @GetMapping
    public List<Bill> getAllBills() {
        return billRepository.findAll();
    }

    @PostMapping
    public ResponseEntity<?> createBill(@RequestBody Bill newBill) {
        // 1. Duplicate Check
        if (newBill.getBillNo() != null && !newBill.getBillNo().equals("Unknown ID")) {
            Optional<Bill> existingBill = billRepository.findAll().stream()
                .filter(b -> newBill.getBillNo().equalsIgnoreCase(b.getBillNo()))
                .findFirst();

            if (existingBill.isPresent()) {
                return ResponseEntity.badRequest().body("Error: Bill " + newBill.getBillNo() + " already exists!");
            }
        }

        // 2. Automated Running Total Calculation
        List<Bill> allBills = billRepository.findAll();
        double previousTotal = allBills.isEmpty() ? 0.0 : allBills.get(allBills.size() - 1).getRunningTotal();
        newBill.setRunningTotal(previousTotal + newBill.getAmount());

        // 3. Save (Timestamp is handled automatically by the Entity @PrePersist)
        Bill savedBill = billRepository.save(newBill);
        return ResponseEntity.ok(savedBill);
    }
}