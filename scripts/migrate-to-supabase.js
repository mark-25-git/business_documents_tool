const fs = require("fs");
const path = require("path");

// Read .env.local variables
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
const SUPABASE_URL = getEnvVar("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_ANON_KEY = getEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY");

if (!GAS_API_URL || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing required environment variables in .env.local");
  process.exit(1);
}

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(SUPABASE_URL.replace(/\/rest\/v1\/?$/, ""), SUPABASE_ANON_KEY);

async function migrate() {
  console.log("Starting migration to Supabase...");

  try {
    // 1. Fetch customers from Google Sheets
    console.log("Fetching customers from Google Sheets...");
    const custRes = await fetch(`${GAS_API_URL}?action=getCustomers`);
    const custJson = await custRes.json();
    if (!custJson.success) {
      throw new Error("Failed to fetch customers: " + custJson.error);
    }
    const customers = custJson.data || [];
    console.log(`Found ${customers.length} customers.`);
    const validCustomerIds = new Set(customers.map(c => c.id));

    // Insert customers into Supabase
    for (const c of customers) {
      console.log(`Inserting customer: ${c.name} (${c.id})...`);
      const { error } = await supabase.from("customers").upsert({
        id: c.id,
        name: c.name,
        phone: c.phone || "",
        address: c.address || "",
        email: c.email || "",
        billing_address: c.billingAddress || "",
        billing_phone: c.billingPhone || "",
        billing_email: c.billingEmail || "",
        shipping_name: c.shippingName || "",
        shipping_address: c.shippingAddress || "",
        shipping_phone: c.shippingPhone || "",
        created_at: c.createdAt || new Date().toISOString()
      });
      if (error) {
        console.error(`Error inserting customer ${c.name}:`, error);
      }
    }

    // 2. Fetch documents list from Google Sheets
    console.log("Fetching documents list from Google Sheets...");
    const docsRes = await fetch(`${GAS_API_URL}?action=getDocuments`);
    const docsJson = await docsRes.json();
    if (!docsJson.success) {
      throw new Error("Failed to fetch documents: " + docsJson.error);
    }
    const docs = docsJson.data || [];
    console.log(`Found ${docs.length} documents.`);

    // Process from oldest to newest to preserve proper sequencing order
    const oldestToNewestDocs = [...docs].reverse();

    for (const docSummary of oldestToNewestDocs) {
      console.log(`Fetching full document details: ${docSummary.docNumber} (${docSummary.id})...`);
      const docRes = await fetch(`${GAS_API_URL}?action=getDocument&id=${docSummary.id}`);
      const docJson = await docRes.json();
      if (!docJson.success) {
        console.error(`Failed to fetch document details for ${docSummary.id}:`, docJson.error);
        continue;
      }
      const doc = docJson.data;

      // Extract raw date (YYYY-MM-DD)
      const rawDate = doc.date ? doc.date.split("T")[0] : new Date().toISOString().split("T")[0];

      console.log(`Upserting document: ${doc.docNumber}...`);
      const { error: docError } = await supabase.from("documents").upsert({
        id: doc.id,
        doc_number: doc.docNumber,
        type: doc.type,
        date: rawDate,
        customer_id: (doc.customerId && validCustomerIds.has(doc.customerId)) ? doc.customerId : null,
        customer_name: doc.customerName,
        total_amount: Number(doc.totalAmount || 0),
        status: doc.status,
        notes: doc.notes || "",
        billing_address: doc.billingAddress || "",
        billing_phone: doc.billingPhone || "",
        billing_email: doc.billingEmail || "",
        shipping_name: doc.shippingName || "",
        shipping_address: doc.shippingAddress || "",
        shipping_phone: doc.shippingPhone || "",
        created_at: docSummary.createdAt || new Date().toISOString()
      });

      if (docError) {
        console.error(`Error upserting document ${doc.docNumber}:`, docError);
        continue;
      }

      // Delete old line items
      const { error: delError } = await supabase
        .from("line_items")
        .delete()
        .eq("doc_id", doc.id);
      
      if (delError) {
        console.error(`Error clearing line items for ${doc.docNumber}:`, delError);
      }

      // Insert line items
      if (doc.items && doc.items.length > 0) {
        console.log(`Inserting ${doc.items.length} line items for: ${doc.docNumber}...`);
        const itemsToInsert = doc.items.map((item) => ({
          id: item.id || "ITEM-" + Math.random().toString(36).substr(2, 9),
          doc_id: doc.id,
          description: item.description,
          quantity: Number(item.quantity || 1),
          unit_price: Number(item.unitPrice || 0),
          amount: Number(item.amount || 0)
        }));

        const { error: itemsError } = await supabase.from("line_items").insert(itemsToInsert);
        if (itemsError) {
          console.error(`Error inserting line items for ${doc.docNumber}:`, itemsError);
        }
      }
    }

    console.log("Migration successfully complete!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed with error:", error);
    process.exit(1);
  }
}

migrate();
