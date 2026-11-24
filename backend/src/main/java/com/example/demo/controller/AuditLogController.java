package com.example.demo.controller;

import com.example.demo.entity.AuditLog;
import com.example.demo.repository.AuditLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/bills")
@CrossOrigin(origins = "http://localhost:3000")
public class AuditLogController {

    @Autowired
    private AuditLogRepository auditLogRepository;

    @GetMapping("/{billId}/audit-logs")
    public ResponseEntity<List<AuditLog>> getBillAuditHistory(@PathVariable Long billId) {
        List<AuditLog> logs = auditLogRepository.findByBillIdOrderByTimestampAsc(billId);
        return ResponseEntity.ok(logs);
    }
}