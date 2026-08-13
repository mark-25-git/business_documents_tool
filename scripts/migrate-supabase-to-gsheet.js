const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

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
const SUPABASE_URL = getEnvVar("NEXT_PUBLIC_SUPABASE_URL").replace(/\/rest\/v1\/?$/, "");
const SUPABASE_ANON_KEY = getEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY");

if (!GAS_API_URL || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing required environment variables in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function migrate() {
  console.log("Starting migration from Supabase to Google Sheets...");

  try {
    // 1. Fetch current Google Sheet Customers
    console.log("Fetching existing customers from Google Sheets...");
    const gSheetCustRes = await fetch(`${GAS_API_URL}?action=getCustomers`);
    const gSheetCustJson = await gSheetCustRes.json();
    const gSheetCustomers = (gSheetCustJson.data || []);
    const gSheetCustMap = new Map();
    gSheetCustomers.forEach((c) => {
      gSheetCustMap.set(c.id || c.CustomerID, c);
    });
    console.log(`Found ${gSheetCustomers.length} existing customers in Google Sheets.`);

    // 2. Fetch Customers from Supabase
    console.log("Fetching customers from Supabase...");
    const { data: supabaseCustomers, error: custErr } = await supabase
      .from("customers")
      .select("*");

    if (custErr) {
      throw new Error("Failed to fetch customers from Supabase: " + custErr.message);
    }
    console.log(`Found ${(supabaseCustomers || []).length} customers in Supabase.`);

    let syncedCustomers = 0;
    for (const c of (supabaseCustomers || [])) {
      if (!gSheetCustMap.has(c.id)) {
        console.log(`Pushing customer ${c.name} (${c.id}) to Google Sheets...`);
        const payload = {
          id: c.id,
          name: c.name,
          phone: c.phone || "",
          address: c.address || "",
          email: c.email || "",
          billingAddress: c.billing_address || c.address || "",
          billingPhone: c.billing_phone || c.phone || "",
          billingEmail: c.billing_email || c.email || "",
          shippingName: c.shipping_name || c.name || "",
          shippingAddress: c.shipping_address || c.address || "",
          shippingPhone: c.shipping_phone || c.phone || ""
        };

        const res = await fetch(`${GAS_API_URL}?action=createCustomer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const resJson = await res.json();
        if (resJson.success) {
          syncedCustomers++;
        } else {
          console.error(`Failed to push customer ${c.name}:`, resJson.error);
        }
      }
    }
    console.log(`Synced ${syncedCustomers} new customers to Google Sheets.`);

    // 3. Fetch current Google Sheet Documents
    console.log("Fetching existing documents from Google Sheets...");
    const gSheetDocsRes = await fetch(`${GAS_API_URL}?action=getDocuments`);
    const gSheetDocsJson = await gSheetDocsRes.json();
    const gSheetDocs = (gSheetDocsJson.data || []);
    const gSheetDocMap = new Map();
    gSheetDocs.forEach((d) => {
      gSheetDocMap.set(d.id || d.DocID, d);
      if (d.docNumber || d.DocNumber) {
        gSheetDocMap.set(d.docNumber || d.DocNumber, d);
      }
    });
    console.log(`Found ${gSheetDocs.length} existing documents in Google Sheets.`);

    // 4. Fetch Documents from Supabase
    console.log("Fetching documents from Supabase...");
    const { data: supabaseDocs, error: docErr } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: true });

    if (docErr) {
      throw new Error("Failed to fetch documents from Supabase: " + docErr.message);
    }
    console.log(`Found ${(supabaseDocs || []).length} documents in Supabase.`);

    let syncedDocs = 0;
    for (const doc of (supabaseDocs || [])) {
      if (!gSheetDocMap.has(doc.id) && !gSheetDocMap.has(doc.doc_number)) {
        console.log(`Fetching line items for document ${doc.doc_number} (${doc.id})...`);
        const { data: items, error: itemErr } = await supabase
          .from("line_items")
          .select("*")
          .eq("doc_id", doc.id);

        if (itemErr) {
          console.error(`Failed to fetch items for ${doc.doc_number}:`, itemErr.message);
          continue;
        }

        console.log(`Pushing document ${doc.doc_number} to Google Sheets...`);
        const payload = {
          id: doc.id,
          docNumber: doc.doc_number,
          type: doc.type,
          date: doc.date,
          customerId: doc.customer_id,
          customerName: doc.customer_name,
          totalAmount: Number(doc.total_amount || 0),
          status: doc.status,
          notes: doc.notes || "",
          billingAddress: doc.billing_address || "",
          billingPhone: doc.billing_phone || "",
          billingEmail: doc.billing_email || "",
          shippingName: doc.shipping_name || "",
          shippingAddress: doc.shipping_address || "",
          shippingPhone: doc.shipping_phone || "",
          items: (items || []).map((i) => ({
            id: i.id,
            description: i.description,
            quantity: Number(i.quantity || 1),
            unitPrice: Number(i.unit_price || 0),
            amount: Number(i.amount || 0)
          }))
        };

        const res = await fetch(`${GAS_API_URL}?action=createDocument`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const resJson = await res.json();
        if (resJson.success) {
          syncedDocs++;
        } else {
          console.error(`Failed to push document ${doc.doc_number}:`, resJson.error);
        }
      }
    }

    console.log(`Synced ${syncedDocs} new documents to Google Sheets.`);
    console.log("Migration complete!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();
