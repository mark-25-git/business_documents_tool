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

if (!GAS_API_URL || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing required environment variables in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runReimport() {
  console.log("================================================================================");
  console.log("FULL RE-IMPORT: SUPABASE TO GOOGLE SHEETS");
  console.log("================================================================================");

  try {
    // 1. Fetch Customers from Supabase
    console.log("Fetching customers from Supabase...");
    const { data: supaCustomers, error: custErr } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: true });

    if (custErr) throw new Error("Failed to fetch customers from Supabase: " + custErr.message);
    console.log(`Retrieved ${supaCustomers.length} customers from Supabase.`);

    // 2. Fetch Documents & Items from Supabase
    console.log("Fetching documents from Supabase...");
    const { data: supaDocs, error: docErr } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: true });

    if (docErr) throw new Error("Failed to fetch documents from Supabase: " + docErr.message);
    console.log(`Retrieved ${supaDocs.length} documents from Supabase.`);

    // 3. Clear Google Sheet Data (if endpoint available or manually push records)
    console.log("\nClearing Google Sheets data via API...");
    try {
      const clearRes = await fetch(`${GAS_API_URL}?action=clearAllData`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const clearJson = await clearRes.json();
      console.log("Clear result:", clearJson);
    } catch (e) {
      console.log("Note on clear action:", e.message);
    }

    // 4. Push Customers to Google Sheets
    console.log("\nRe-importing customers to Google Sheets...");
    let importedCustomers = 0;
    for (const c of supaCustomers) {
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
        importedCustomers++;
        console.log(`✓ Customer (${importedCustomers}/${supaCustomers.length}): ${c.name}`);
      } else {
        console.error(`✗ Failed customer ${c.name}:`, resJson.error);
      }
    }

    // 5. Push Documents & Line Items to Google Sheets
    console.log("\nRe-importing documents to Google Sheets...");
    let importedDocs = 0;
    for (const doc of supaDocs) {
      const { data: items, error: itemErr } = await supabase
        .from("line_items")
        .select("*")
        .eq("doc_id", doc.id);

      if (itemErr) {
        console.error(`Error fetching items for ${doc.doc_number}:`, itemErr.message);
      }

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
        importedDocs++;
        console.log(`✓ Document (${importedDocs}/${supaDocs.length}): ${doc.doc_number} - ${doc.customer_name}`);
      } else {
        console.error(`✗ Failed document ${doc.doc_number}:`, resJson.error);
      }
    }

    console.log("\n================================================================================");
    console.log("RE-IMPORT SUMMARY");
    console.log("================================================================================");
    console.log(`Customers Imported: ${importedCustomers} / ${supaCustomers.length}`);
    console.log(`Documents Imported: ${importedDocs} / ${supaDocs.length}`);
    console.log("================================================================================");

  } catch (err) {
    console.error("Fatal error during re-import:", err);
  }
}

runReimport();
