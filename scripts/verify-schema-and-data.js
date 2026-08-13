const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const envPath = path.join(__dirname, "../.env.local");
if (!fs.existsSync(envPath)) {
  console.error("Missing .env.local file");
  process.exit(1);
}
const envContent = fs.readFileSync(envPath, "utf8");

const getEnvVar = (name) => {
  const match = envContent.match(new RegExp(`${name}\\s*=\\s*(.+)`));
  return match ? match[1].trim() : "";
};

const GAS_API_URL = getEnvVar("NEXT_PUBLIC_GAS_API_URL");
const SUPABASE_URL = getEnvVar("NEXT_PUBLIC_SUPABASE_URL").replace(/\/rest\/v1\/?$/, "");
const SUPABASE_ANON_KEY = getEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runAudit() {
  console.log("================================================================================");
  console.log("DATABASE SCHEMA AND DATA COMPARISON AUDIT (Supabase vs Google Sheets)");
  console.log("================================================================================");

  // 1. Fetch Supabase Data
  const { data: supaCustomers } = await supabase.from("customers").select("*");
  const { data: supaDocs } = await supabase.from("documents").select("*");
  const { data: supaItems } = await supabase.from("line_items").select("*");

  // 2. Fetch Google Sheets Data
  const gCustRes = await fetch(`${GAS_API_URL}?action=getCustomers`);
  const gCustJson = await gCustRes.json();
  const gSheetCustomers = gCustJson.data || [];

  const gDocsRes = await fetch(`${GAS_API_URL}?action=getDocuments`);
  const gDocsJson = await gDocsRes.json();
  const gSheetDocs = gDocsJson.data || [];

  console.log("\n--- RECORD COUNTS ---");
  console.log(`Customers:  Supabase = ${supaCustomers ? supaCustomers.length : 0} | Google Sheets = ${gSheetCustomers.length}`);
  console.log(`Documents:  Supabase = ${supaDocs ? supaDocs.length : 0} | Google Sheets = ${gSheetDocs.length}`);
  console.log(`Line Items: Supabase = ${supaItems ? supaItems.length : 0} | Google Sheets (Items loaded per document)`);

  console.log("\n--- SCHEMA COLUMN MAPPING COMPARISON ---");
  
  const customerFields = [
    { supa: "id", gsheet: "CustomerID / id" },
    { supa: "name", gsheet: "Name / name" },
    { supa: "phone", gsheet: "Phone / phone" },
    { supa: "address", gsheet: "Address / address" },
    { supa: "email", gsheet: "Email / email" },
    { supa: "billing_address", gsheet: "BillingAddress / billingAddress" },
    { supa: "billing_phone", gsheet: "BillingPhone / billingPhone" },
    { supa: "billing_email", gsheet: "BillingEmail / billingEmail" },
    { supa: "shipping_name", gsheet: "ShippingName / shippingName" },
    { supa: "shipping_address", gsheet: "ShippingAddress / shippingAddress" },
    { supa: "shipping_phone", gsheet: "ShippingPhone / shippingPhone" },
    { supa: "created_at", gsheet: "CreatedAt / createdAt" }
  ];

  console.log("\n1. CUSTOMERS TABLE FIELDS:");
  customerFields.forEach(f => {
    console.log(`   - Supabase: ${f.supa.padEnd(20)} <===> Google Sheets: ${f.gsheet}`);
  });

  const documentFields = [
    { supa: "id", gsheet: "DocID / id" },
    { supa: "doc_number", gsheet: "DocNumber / docNumber" },
    { supa: "type", gsheet: "Type / type" },
    { supa: "date", gsheet: "Date / date" },
    { supa: "customer_id", gsheet: "CustomerID / customerId" },
    { supa: "customer_name", gsheet: "CustomerName / customerName" },
    { supa: "total_amount", gsheet: "TotalAmount / totalAmount" },
    { supa: "status", gsheet: "Status / status" },
    { supa: "notes", gsheet: "Notes / notes" },
    { supa: "billing_address", gsheet: "BillingAddress / billingAddress" },
    { supa: "billing_phone", gsheet: "BillingPhone / billingPhone" },
    { supa: "billing_email", gsheet: "BillingEmail / billingEmail" },
    { supa: "shipping_name", gsheet: "ShippingName / shippingName" },
    { supa: "shipping_address", gsheet: "ShippingAddress / shippingAddress" },
    { supa: "shipping_phone", gsheet: "ShippingPhone / shippingPhone" },
    { supa: "created_at", gsheet: "CreatedAt / createdAt" }
  ];

  console.log("\n2. DOCUMENTS TABLE FIELDS:");
  documentFields.forEach(f => {
    console.log(`   - Supabase: ${f.supa.padEnd(20)} <===> Google Sheets: ${f.gsheet}`);
  });

  const lineItemFields = [
    { supa: "id", gsheet: "ItemID / id" },
    { supa: "doc_id", gsheet: "DocID / docId" },
    { supa: "description", gsheet: "Description / description" },
    { supa: "quantity", gsheet: "Quantity / quantity" },
    { supa: "unit_price", gsheet: "UnitPrice / unitPrice" },
    { supa: "amount", gsheet: "Amount / amount" }
  ];

  console.log("\n3. LINE ITEMS TABLE FIELDS:");
  lineItemFields.forEach(f => {
    console.log(`   - Supabase: ${f.supa.padEnd(20)} <===> Google Sheets: ${f.gsheet}`);
  });

  // Check missing IDs
  const supaCustIds = new Set((supaCustomers || []).map(c => c.id));
  const gCustIds = new Set(gSheetCustomers.map(c => c.id || c.CustomerID));

  const missingCustInGSheet = (supaCustomers || []).filter(c => !gCustIds.has(c.id));
  const missingCustInSupa = gSheetCustomers.filter(c => !supaCustIds.has(c.id || c.CustomerID));

  console.log(`\nCustomers only in Supabase: ${missingCustInGSheet.length}`);
  console.log(`Customers only in Google Sheets: ${missingCustInSupa.length}`);

  const supaDocNumbers = new Set((supaDocs || []).map(d => d.doc_number));
  const gDocNumbers = new Set(gSheetDocs.map(d => d.docNumber || d.DocNumber));

  const missingDocsInGSheet = (supaDocs || []).filter(d => !gDocNumbers.has(d.doc_number));
  const missingDocsInSupa = gSheetDocs.filter(d => !supaDocNumbers.has(d.docNumber || d.DocNumber));

  console.log(`Documents only in Supabase: ${missingDocsInGSheet.length}`);
  console.log(`Documents only in Google Sheets: ${missingDocsInSupa.length}`);

  console.log("================================================================================");
}

runAudit();
