package com.example.demo.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import lombok.Data;

@Entity
@Data
public class Bill {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String eventName;
    private String vendorName;
    private BigDecimal amount;
    private String status;
    private BigDecimal runningTotal;
    private String description;
    
    // Modern Java handles this perfectly without the @Temporal annotation!
    private LocalDateTime timestamp; 
}