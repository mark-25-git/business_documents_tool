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

const SUPABASE_URL = getEnvVar("NEXT_PUBLIC_SUPABASE_URL").replace(/\/rest\/v1\/?$/, "");
const SUPABASE_ANON_KEY = getEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing required environment variables in .env.local");
  process.exit(1);
}

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Define inline JS versions of api.ts logic for runtime compatibility in CJS Node
async function getNextDocNumber() {
  const now = new Date();
  const year = now.getFullYear().toString().substr(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `${year}${month}-`;

  const { data, error } = await supabase
    .from("documents")
    .select("doc_number")
    .like("doc_number", `${prefix}%`)
    .order("doc_number", { ascending: false })
    .limit(1);

  if (error) throw error;

  let counter = 1;
  if (data && data.length > 0) {
    const lastNum = data[0].doc_number;
    const parts = lastNum.split("-");
    if (parts.length === 2) {
      const parsed = parseInt(parts[1], 10);
      if (!isNaN(parsed)) {
        counter = parsed + 1;
      }
    }
  }

  const paddedCount = counter.toString().padStart(3, "0");
  return `${year}${month}-${paddedCount}`;
}

async function runTests() {
  console.log("=".repeat(80));
  console.log("SUPABASE DATABASE INTEGRATION UNIT TESTS");
  console.log("=".repeat(80));
  console.log("");

  let passed = 0;
  let failed = 0;
  let testCustId = null;
  let testDocId = null;
  let testDocNumber = null;

  const assert = (condition, message) => {
    if (condition) {
      passed++;
      console.log(`✓ ${message}: PASS`);
    } else {
      failed++;
      console.log(`✗ ${message}: FAIL`);
    }
  };

  try {
    // Test 1: Generate next document number
    console.log("Running Test 1: getNextDocNumber...");
    const nextNum = await getNextDocNumber();
    assert(typeof nextNum === "string" && /^\d{4}-\d{3}$/.test(nextNum), `Generated sequential doc number: ${nextNum}`);

    // Test 2: Fetch customers list
    console.log("\nRunning Test 2: getCustomers...");
    const { data: customersList, error: custErr } = await supabase
      .from("customers")
      .select("*")
      .limit(10);
    assert(!custErr && Array.isArray(customersList), `Fetched customers list successfully (Count: ${customersList ? customersList.length : 0})`);

    // Test 3: Create a test customer
    console.log("\nRunning Test 3: createCustomer...");
    const custId = 'CUST-' + new Date().getTime();
    const { error: insertCustErr } = await supabase.from("customers").insert({
      id: custId,
      name: "INTEGRATION TEST Customer",
      phone: "012-3456789",
      address: "123 Test Street",
      email: "test@integration.com",
      billing_address: "123 Test Street",
      billing_phone: "012-3456789",
      billing_email: "test@integration.com",
      shipping_name: "INTEGRATION TEST Customer",
      shipping_address: "123 Test Street",
      shipping_phone: "012-3456789"
    });
    assert(!insertCustErr, `Created test customer with ID: ${custId}`);
    if (!insertCustErr) {
      testCustId = custId;
    }

    // Test 4: Create a test document
    console.log("\nRunning Test 4: createDocument...");
    if (testCustId) {
      const nextDocNum = await getNextDocNumber();
      const docId = 'DOC-' + new Date().getTime();

      const { error: insertDocErr } = await supabase.from("documents").insert({
        id: docId,
        doc_number: nextDocNum,
        type: "INVOICE",
        date: new Date().toISOString().split("T")[0],
        customer_id: testCustId,
        customer_name: "INTEGRATION TEST Customer",
        total_amount: 150.00,
        status: "PENDING",
        notes: "Integration test notes",
        billing_address: "123 Test Street",
        billing_phone: "012-3456789",
        billing_email: "test@integration.com",
        shipping_name: "INTEGRATION TEST Customer",
        shipping_address: "123 Test Street",
        shipping_phone: "012-3456789"
      });

      assert(!insertDocErr, `Created test document header: ${nextDocNum} (ID: ${docId})`);
      if (!insertDocErr) {
        testDocId = docId;
        testDocNumber = nextDocNum;

        // Insert items
        const { error: insertItemsErr } = await supabase.from("line_items").insert([
          { id: "ITEM-A-" + Date.now(), doc_id: docId, description: "Integration Product A", quantity: 2, unit_price: 50.00, amount: 100.00 },
          { id: "ITEM-B-" + Date.now(), doc_id: docId, description: "Integration Product B", quantity: 1, unit_price: 50.00, amount: 50.00 }
        ]);
        assert(!insertItemsErr, "Inserted line items successfully");
      }
    } else {
      console.log("Skipping Test 4 (Customer insertion failed)");
    }

    // Test 5: Fetch document details
    console.log("\nRunning Test 5: getDocument details...");
    if (testDocId) {
      const { data: docHeader, error: fetchDocErr } = await supabase
        .from("documents")
        .select("*")
        .eq("id", testDocId)
        .single();
      
      const { data: docItems, error: fetchItemsErr } = await supabase
        .from("line_items")
        .select("*")
        .eq("doc_id", testDocId);

      assert(
        !fetchDocErr && !fetchItemsErr && docHeader && docItems && docItems.length === 2,
        `Retrieved document details and confirmed items count (Expected: 2, Got: ${docItems ? docItems.length : 0})`
      );
    } else {
      console.log("Skipping Test 5 (Document insertion failed)");
    }

    // Test 6: Get Autocomplete Suggestions
    console.log("\nRunning Test 6: getItemSuggestions...");
    const { data: suggestions, error: suggestErr } = await supabase
      .from("line_items")
      .select("description, unit_price")
      .limit(10);
    assert(!suggestErr && Array.isArray(suggestions), `Fetched auto-complete suggestions successfully (Count: ${suggestions ? suggestions.length : 0})`);

    // Test 7: Cleanup
    console.log("\nRunning Test 7: Cleanup...");
    if (testDocId) {
      const { error: delDocErr } = await supabase.from("documents").delete().eq("id", testDocId);
      assert(!delDocErr, "Cleaned up test document");
    }
    if (testCustId) {
      const { error: delCustErr } = await supabase.from("customers").delete().eq("id", testCustId);
      assert(!delCustErr, "Cleaned up test customer");
    }

  } catch (error) {
    console.error("Test suite caught error:", error);
    failed++;
  }

  // Summary
  console.log("");
  console.log("=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log("=".repeat(80));

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
