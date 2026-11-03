-- 1. Initialize the Database
CREATE DATABASE IF NOT EXISTS billstack_db;
USE billstack_db;

-- 2. Temporarily disable foreign key checks to allow clean resets
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS bills;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- 3. Create Users Table (Includes MAIN_EVENT_HEAD and all other required roles)
CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('STUDENT', 'STUDENT_HEAD', 'FACULTY', 'EVENT_HEAD', 'MAIN_EVENT_HEAD', 'STOREKEEPER', 'PRINCIPAL', 'ADMIN', 'ACCOUNTS', 'TEACHER') NOT NULL
);

-- 4. Create Events Table (Supports Master/Sub-event hierarchy, Main Event Head assignment, and ACTIVE/CLOSED lifecycle)
CREATE TABLE events (
    event_id INT PRIMARY KEY AUTO_INCREMENT,
    wing_name VARCHAR(100) NOT NULL, -- Master Event / Wing name
    sub_event_name VARCHAR(100) NOT NULL, -- Sub-event name
    allocated_budget DECIMAL(15, 2) NOT NULL,
    parent_event_id INT DEFAULT NULL, -- NULL = Master Event, ID = Sub-event
    main_head_id INT DEFAULT NULL, -- ID of the Main Event Head who initiated it
    status ENUM('ACTIVE', 'CLOSED') DEFAULT 'ACTIVE',
    CONSTRAINT fk_event_parent FOREIGN KEY (parent_event_id) REFERENCES events(event_id) ON DELETE CASCADE,
    CONSTRAINT fk_event_main_head FOREIGN KEY (main_head_id) REFERENCES users(user_id)
);

-- 5. Create Bills Table (Includes the new PENDING_MAIN_HEAD approval stage)
CREATE TABLE bills (
    bill_id INT PRIMARY KEY AUTO_INCREMENT,
    event_id INT,
    uploader_id INT,
    vendor_name VARCHAR(100),
    amount DECIMAL(15, 2),
    -- Approval Pipeline: DRAFT -> PENDING_FACULTY -> PENDING_MAIN_HEAD -> PENDING_STOREKEEPER -> PENDING_PRINCIPAL -> APPROVED / REJECTED
    status ENUM('DRAFT', 'PENDING_FACULTY', 'PENDING_MAIN_HEAD', 'PENDING_STOREKEEPER', 'PENDING_PRINCIPAL', 'APPROVED', 'REJECTED') DEFAULT 'DRAFT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(event_id),
    FOREIGN KEY (uploader_id) REFERENCES users(user_id)
);

-- 6. Create Audit Logs Table
CREATE TABLE audit_logs (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    bill_id INT,
    action_by INT,
    action_type VARCHAR(50), 
    action_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bill_id) REFERENCES bills(bill_id),
    FOREIGN KEY (action_by) REFERENCES users(user_id)
);