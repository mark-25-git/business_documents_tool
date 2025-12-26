# Megah Invoice Tool

A modern business document generator (Invoice, Quotation, Receipt) using Next.js and Google Sheets.

## Setup Instructions

### 1. Google Sheets Backend
1. Create a new Google Sheet.
2. Go to **Extensions > Apps Script**.
3. Copy the code from `google_apps_script_source/Code.js` in this project.
4. Paste it into the Apps Script editor (replace existing code).
5. Click **Deploy > New Deployment**.
   - **Select type:** Web App.
   - **Description:** v1.
   - **Execute as:** Me (your email).
   - **Who has access:** Anyone (or Anyone with Google Account if for internal use only).
6. Copy the **Web App URL**.

### 2. Frontend Setup
1. Create a file named `.env.local` in the root of this project.
2. Add your Web App URL:
   ```bash
   NEXT_PUBLIC_GAS_API_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```

## Features
- **Documents:** Create Invoices, Quotations, and Receipts.
- **Auto-Numbering:** Generates IDs in format `YYMM-XXX` (resets monthly).
- **Database:** Stores all data in your Google Sheet tabs (Documents, LineItems, Customers).
- **Printing:** Clean, print-friendly layout for generating PDFs (Ctrl+P).

## Deployment

### Deploy to Vercel

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/megah-invoice-tool.git
   git push -u origin main
   ```

2. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com) and sign in
   - Click "Add New Project"
   - Import your GitHub repository
   - Configure environment variable:
     - **Name:** `NEXT_PUBLIC_GAS_API_URL`
     - **Value:** Your Google Apps Script Web App URL
   - Click "Deploy"

3. **After Deployment:**
   - Your app will be live at `https://your-project.vercel.app`
   - Vercel automatically deploys on every push to main branch

### Environment Variables

For production deployment, set this environment variable in Vercel:
- `NEXT_PUBLIC_GAS_API_URL` - Your Google Apps Script Web App URL

**Note:** Since this uses `NEXT_PUBLIC_` prefix, it will be exposed to the browser. Make sure your Google Apps Script deployment has appropriate access controls.

