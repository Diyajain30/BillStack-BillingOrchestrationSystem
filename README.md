# BillStack: Automated Billing Orchestration System

BillStack is a full-stack financial orchestration platform engineered to eliminate paper-intensive reimbursement bottlenecks in academic institutions and large-scale college events (such as the "Wings" Technical Fest). The platform integrates an AI-driven OCR extraction microservice, a transactional Java Spring Boot ledger, a multi-stage approval conveyor belt, client-side duplex audit PDF generation, and executive Power BI analytics.

---

## Architecture Overview

```text
                         +-----------------------------------+
                         |    React 19 Frontend (Vite)       |
                         |   (Port 3000 / Role Dashboards)   |
                         +-----------------+-----------------+
                                           |
                  +------------------------+------------------------+
                  | (Proxy: /ocr)                                   | (Proxy: /api)
                  v                                                 v
+-----------------------------------+             +-----------------------------------+
|     Python FastAPI Microservice   |             |     Java Spring Boot REST API     |
|      (Port 5000 / EasyOCR AI)     |             |      (Port 8080 / MVC Ledger)     |
+-----------------------------------+             +-----------------+-----------------+
                                                                    |
                                                                    v
                                                  +-----------------------------------+
                                                  |        MySQL Relational DB        |
                                                  |          (billstack_db)           |
                                                  +-----------------+-----------------+
                                                                    |
                                                                    v
                                                  +-----------------------------------+
                                                  |      Power BI Desktop Engine      |
                                                  |   (BillStack_Dashboard.pbix)      |
                                                  +-----------------------------------+
```

---

## Core Capabilities

* **AI-Assisted Invoice Parsing:** Dedicated Python FastAPI microservice utilizing EasyOCR with custom regex pattern-matching to automatically extract invoice numbers, vendor names, GSTINs, dates, and line-item tax distributions.
* **Sequential Approval Conveyor Belt:** Multi-stage role-based state machine enforcing sequential authorizations:
  $$\text{Event Head (Submit)} \longrightarrow \text{Faculty Review} \longrightarrow \text{Storekeeper Note} \longrightarrow \text{Principal Sanction (Final Approval)}$$
  If discrepancies arise, reviewers can return the bill with mandatory feedback notes to trigger coordinator revision loops.
* **Progressive Audit Running Totals:** The Spring Boot backend recalculates progressive running totals upon every approved entry, preventing event overspending and ensuring ledger trace-auditing.
* **Duplex Alternating PDF Generation:** Implemented via `jspdf` to create formal audit vouchers on Page 1 (ledger particulars and signature blocks) and raw receipts affixed on Page 2 to satisfy institutional audit mandates.
* **Budget Guardrail Analytics:** A connected Power BI dashboard tracks sub-event expenditures, vendor allocation breakdowns, and real-time budget consumption against an upper ceiling, complete with an 80% spending warning threshold.

---

## Repository Structure

```text
BillStack/
├── analytics/                   # Data schemas, exports, and Power BI models
│   ├── schema.sql               # Relational database table schemas
│   └── BillStack_Dashboard.pbix # Interactive executive reporting workspace
├── backend/                     # Spring Boot core backend application
│   ├── pom.xml                  # Maven dependencies (JPA, MySQL, Web, Lombok)
│   └── src/main/java/com/example/demo/
│       ├── DemoApplication.java # Spring Boot main entry point
│       ├── entity/Bill.java     # Entity model with GSTIN, timestamp, running total
│       ├── repository/          # Spring Data JPA interfaces
│       └── controller/          # REST API endpoints (GET, POST, PUT status update)
├── frontend/                    # Single-page web portal built on React 19
│   ├── vite.config.js           # Vite dev server and proxy routes
│   ├── package.json             # NPM package configurations
│   └── src/
│       ├── components/          # Role dashboards (Student, Faculty, Admin)
│       ├── pages/Dashboard.jsx  # Role-based route dispatcher
│       └── services/api.js      # Centralized Axios API instances
└── ocr-service/                 # Computer vision extraction microservice
    ├── Main.py                  # FastAPI server hosting EasyOCR pipeline
    └── requirements.txt         # Python libraries (fastapi, uvicorn, easyocr)
```

---

## Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS v4, Axios, `jspdf`, React Router |
| **Backend** | Java 17+, Spring Boot 3.x, Spring Data JPA, Hibernate, Lombok |
| **Database** | MySQL 8.0+ (`billstack_db`) |
| **OCR Service** | Python 3.12+, FastAPI, Uvicorn, EasyOCR, PyTorch |
| **Analytics** | Microsoft Power BI Desktop, DAX Query Language |

---

## Local Setup & Execution Guide

### 1. Database Initialization
1. Open MySQL Workbench and execute:
   ```sql
   CREATE DATABASE billstack_db;
   ```
2. Configure credentials in `backend/src/main/resources/application.properties`:
   ```properties
   spring.datasource.url=jdbc:mysql://localhost:3306/billstack_db
   spring.datasource.username=root
   spring.datasource.password=YOUR_MYSQL_PASSWORD
   spring.jpa.hibernate.ddl-auto=update
   ```

### 2. Python OCR Microservice Setup
Navigate to the `ocr-service` folder, install dependencies, and launch the server:
```powershell
cd ocr-service
python -m pip install fastapi uvicorn easyocr python-multipart requests
python Main.py
```
* Interactive API Documentation: `http://127.0.0.1:5000/docs`

### 3. Spring Boot Backend Engine Setup
From the project root, navigate to the `backend` folder and run the Maven wrapper:
```powershell
cd backend
./mvnw spring-boot:run
```
* Service Base URL: `http://localhost:8080/api/bills`

### 4. React 19 Frontend Portal Setup
From the project root, navigate to the `frontend` folder and boot the development server:
```powershell
cd frontend
npm install
npm run dev
```
* Application Portal: `http://localhost:3000`

### 5. Power BI Executive Analytics
1. Open `analytics/BillStack_Dashboard.pbix` in Power BI Desktop.
2. Click **Refresh** on the Home ribbon to sync live transactions from MySQL.
3. For spending warning detection, utilize the target DAX measure:
   ```dax
   Budget Warning 80% = 100000 * 0.80
   ```

---

## REST API Reference

| HTTP Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/extract-bill` | Accepts receipt image and returns parsed OCR financial JSON |
| `GET` | `/api/bills` | Retrieves all registered bills with running totals |
| `POST` | `/api/bills` | Persists verified invoice and recalculates cumulative total |
| `PUT` | `/api/bills/{id}/status` | Advances approval status and logs audit remarks |

---

