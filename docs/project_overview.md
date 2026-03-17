# Megah Invoice Tool: Project Overview

The **Megah Invoice Tool** is a professional-grade business document generator designed to streamline the creation of Invoices, Quotations, Receipts, and Delivery Orders. It leverages a modern, decoupled architecture to provide high-fidelity PDF generation with a lightweight, serverless backend.

## 🏗️ System Architecture

The application follows a **Decoupled Serverless** pattern:

- **Frontend (UI Layer)**: Next.js 14 application providing an interactive editor.
  - **PDF Engine**: Uses `@react-pdf/renderer` for client-side, high-fidelity PDF synthesis.
  - **Styling**: Tailwind CSS for a modern, responsive interface.
- **Backend (API Layer)**: Google Apps Script (GAS) deployed as a Web App.
  - Acts as a secure intermediary between the frontend and the database.
  - Handles business logic like document numbering and data mapping.
- **Database (Data Layer)**: Google Sheets.
  - Provides a visible, user-friendly data store with tabs for `Documents`, `LineItems`, and `Customers`.

## ✨ Key Features

- **Document Versatility**: Supports Invoices, Quotations, Receipts, and Delivery Orders (DO).
- **Dual-Address Management**: Intelligent logic that distinguishes between Billing and Shipping profiles, automatically pivoting based on document type.
- **Monthly Auto-Numbering**: Resets document IDs monthly (e.g., `2603-001`) for organized record-keeping.
- **Dynamic Schema Sync**: The backend uses case-insensitive header detection, allowing for flexible Google Sheets management without breaking the application.
- **Tax Virtualization**: Persists tax information as "virtual fields" within line items to avoid breaking legacy backend schemas.

## 📂 Codebase Structure

- [`/app`](file:///d:/GoogleAppsScript/megah-invoice-tool/app): Next.js routes handling the main application flow.
- [`/components`](file:///d:/GoogleAppsScript/megah-invoice-tool/components): Modular React components for editing and PDF rendering.
- [`/google_apps_script_source`](file:///d:/GoogleAppsScript/megah-invoice-tool/google_apps_script_source): The logic powering the Google Sheets integration.
- [`/lib`](file:///d:/GoogleAppsScript/megah-invoice-tool/lib): Shared utilities and schema validations (Zod).

## 🚀 Recent Improvements

- **Multiline Support**: Descriptions now use `Textarea` components for better readability.
- **Standardized UI**: Consistent Title Case casing across all labels and standardized modal layouts.
- **Tax Handling**: Seamless integration of tax components without database schema modifications.
