# Megah Invoice Tool

A professional business document generator (Invoice, Quotation, Receipt, Delivery Order) built with **Next.js** and **Google Sheets**.

## System Architecture

The application is built on a "Decoupled Serverless" architecture:

- **Frontend (UI Layer)**: A Next.js 14 application hosted on Vercel. 
    - Handles user input, state management, and real-time PDF previews.
    - Uses `@react-pdf/renderer` for high-fidelity PDF generation in the browser.
- **Backend (API Layer)**: Google Apps Script (GAS) deployed as a Web App.
    - Acts as the secure bridge between the web app and the database.
    - Handles document numbering, status management, and data mapping.
- **Database (Data Layer)**: Google Sheets.
    - Stores all persistence data in structured tabs: `Documents`, `LineItems`, `Customers`.

## Core Features

### 1. Dual-Address Management (New)
The system snapshots the specific addresses used at the moment of document creation.
- **Billing Profile**: Stores Name, Address, Phone, and Email for administrative records.
- **Shipping Profile**: Stores Name, Address, and Phone for physical delivery.
- **Auto-Logic**: 
    - **Invoices/Quotations**: Defaults to Billing info.
    - **Delivery Orders (DO)**: Automatically pivots to Shipping info and labels as "Ship To".
    - **Smart UI**: The app sidebar automatically shows a "Shipping Details" card only if a unique delivery destination is detected.

### 2. Intelligent Backend Sync
- **Dynamic Header Detection**: The backend searches for column names (e.g., `ShippingAddress`) case-insensitively. This makes the database robust even if columns are manually moved or added in the spreadsheet.
- **Monthly Auto-Numbering**: Document IDs reset every month (e.g., `2601-001`) to keep numbering clean and professional.

### 3. PDF Engine
- Uses **Helvetica** base fonts for document consistency.
- High-priority resolution logic ensuring the correct profile is selected based on the document type.

## Setup Instructions

### 1. Google Sheets Backend
1. Create a new Google Sheet.
2. Go to **Extensions > Apps Script**.
3. Copy the code from `google_apps_script_source/Code.js` to the editor.
4. Run the `setup()` function to initialize the database schema.
5. Click **Deploy > New Deployment** (Type: Web App, Access: Anyone).
6. Copy the **Web App URL**.

### 2. Frontend Setup
1. Create `.env.local` in the root directory.
2. Add `NEXT_PUBLIC_GAS_API_URL=YOUR_URL_HERE`.
3. Run `npm install` followed by `npm run dev`.

## Data Dictionary (Documents Sheet)
| Column Name | Description |
| :--- | :--- |
| **DocID** | Unique internal reference (DOC-...) |
| **DocNumber** | Professional ID (YYMM-XXX) |
| **Type** | INVOICE, QUOTATION, RECEIPT, DELIVERY_ORDER |
| **BillingAddress** | Snapshotted billing destination |
| **ShippingName** | Snapshotted recipient name |
| **ShippingAddress** | Snapshotted physical destination |

---
Maintainer: Antigravity AI
Version: 2.1.0 (Dual-Address Edition)
