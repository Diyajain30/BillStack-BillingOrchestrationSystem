package com.example.demo.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Data;

@Entity
@Table(name = "bills")
@Data
public class Bill {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // --- Core Fields ---
    private String eventName;
    private String vendorName;
    private Double amount; // This is the Grand Total
    private String description;

    // --- New Audit & OCR Fields ---
    private String billNo;      // For duplicate prevention
    private String vendorGstin; // For tax compliance
    private String billDate;    // Date printed on the bill
    private Double baseAmount;  // Amount before taxes
    private Double cgst;        // Central GST
    private Double sgst;        // State GST

    // --- Automated Logic Fields ---
    private String status = "PENDING_FACULTY";
    private Double runningTotal;
    private LocalDateTime timestamp;

    @PrePersist
    protected void onCreate() {
        this.timestamp = LocalDateTime.now();
    }
}