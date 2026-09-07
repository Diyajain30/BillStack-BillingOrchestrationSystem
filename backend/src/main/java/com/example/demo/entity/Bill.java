package com.example.demo.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "bills")
public class Bill {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String vendorName;
    private String billNo;
    private Double amount;
    private Double baseAmount;
    private String billDate;
    private String vendorGstin;
    private Double cgst = 0.0;
    private Double sgst = 0.0;
    private String eventName;
    private Long subEventId; // Sub-event folder isolation key

    @Column(columnDefinition = "TEXT")
    private String description;

    private String status = "PENDING_FACULTY";
    private Double runningTotal = 0.0;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public Bill() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getVendorName() { return vendorName; }
    public void setVendorName(String vendorName) { this.vendorName = vendorName; }

    public String getBillNo() { return billNo; }
    public void setBillNo(String billNo) { this.billNo = billNo; }

    public Double getAmount() { return amount; }
    public void setAmount(Double amount) { this.amount = amount; }

    public Double getBaseAmount() { return baseAmount; }
    public void setBaseAmount(Double baseAmount) { this.baseAmount = baseAmount; }

    public String getBillDate() { return billDate; }
    public void setBillDate(String billDate) { this.billDate = billDate; }

    public String getVendorGstin() { return vendorGstin; }
    public void setVendorGstin(String vendorGstin) { this.vendorGstin = vendorGstin; }

    public Double getCgst() { return cgst; }
    public void setCgst(Double cgst) { this.cgst = cgst; }

    public Double getSgst() { return sgst; }
    public void setSgst(Double sgst) { this.sgst = sgst; }

    public String getEventName() { return eventName; }
    public void setEventName(String eventName) { this.eventName = eventName; }

    public Long getSubEventId() { return subEventId; }
    public void setSubEventId(Long subEventId) { this.subEventId = subEventId; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Double getRunningTotal() { return runningTotal; }
    public void setRunningTotal(Double runningTotal) { this.runningTotal = runningTotal; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}