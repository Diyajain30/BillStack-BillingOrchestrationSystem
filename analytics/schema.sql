-- 1. Initialize the Database
CREATE DATABASE IF NOT EXISTS billstack_db;
USE billstack_db;

-- 2. Create the Users Table (Handles your 7 roles)
CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- You'll use this for login later
    role ENUM('STUDENT_HEAD', 'FACULTY', 'EVENT_HEAD', 'STOREKEEPER', 'PRINCIPAL', 'ADMIN', 'ACCOUNTS') NOT NULL
);

-- 3. Create the Events Table (Wings -> Sub-Events)
CREATE TABLE events (
    event_id INT PRIMARY KEY AUTO_INCREMENT,
    wing_name VARCHAR(100) NOT NULL, -- e.g., "Wings 2026"
    sub_event_name VARCHAR(100) NOT NULL, -- e.g., "Coding Competition"
    allocated_budget DECIMAL(15, 2) NOT NULL
);

-- 4. Create the Bills Table (The logic engine)
CREATE TABLE bills (
    bill_id INT PRIMARY KEY AUTO_INCREMENT,
    event_id INT,
    uploader_id INT,
    vendor_name VARCHAR(100),
    amount DECIMAL(15, 2),
    -- This drives your progress bar and "Conveyor Belt"
    status ENUM('DRAFT', 'PENDING_FACULTY', 'PENDING_STOREKEEPER', 'PENDING_PRINCIPAL', 'APPROVED', 'REJECTED') DEFAULT 'DRAFT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(event_id),
    FOREIGN KEY (uploader_id) REFERENCES users(user_id)
);

-- 5. Create Audit Logs (For transparency)
CREATE TABLE audit_logs (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    bill_id INT,
    action_by INT,
    action_type VARCHAR(50), -- e.g., "Approved by Principal"
    action_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bill_id) REFERENCES bills(bill_id),
    FOREIGN KEY (action_by) REFERENCES users(user_id)
);