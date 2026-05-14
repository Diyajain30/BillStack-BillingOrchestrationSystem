package com.example.demo.controller;

import com.example.demo.entity.Bill;
import com.example.demo.repository.BillRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/bills")
@CrossOrigin(origins = "*") // This allows Student B's React app to talk to your backend without security blocks!
public class BillController {

    @Autowired
    private BillRepository billRepository;

    // 1. GET DOOR: This sends all bills from the database to the frontend
    @GetMapping
    public List<Bill> getAllBills() {
        return billRepository.findAll();
    }

    // 2. POST DOOR: This receives a new bill from the frontend and saves it
    @PostMapping
    public Bill createBill(@RequestBody Bill bill) {
        return billRepository.save(bill);
    }
}