// Local-only, in-memory API for manual UI regression checks. Never uses a real sheet.
const http = require("node:http");
let customers = [{ id: "C-EXAMPLE", name: "Example customer", phone: "0123456789", address: "Example billing address", email: "example@example.com" }];
let documents = [{
  id: "DOC-EXAMPLE", docNumber: "2611-001 (rev01)", type: "INVOICE", date: "2026-11-03", customerId: "C-EXAMPLE",
  customerName: "Example customer", totalAmount: 550, status: "PENDING", billingAddress: "Example billing address",
  billingPhone: "0123456789", billingEmail: "example@example.com", shippingName: "Warehouse recipient",
  shippingAddress: "Example warehouse", shippingPhone: "0123456789", deliveryFee: 0, isFreeDelivery: true,
  items: [...Array.from({ length: 50 }, (_, i) => ({ description: `Example product ${i + 1}\nSecond line for wrapping`, quantity: 1, unitPrice: 10, amount: 10 })),
    { description: "TAX:SST 10%", quantity: 1, unitPrice: 50, amount: 50 }],
}];
const counts = {};
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") { res.end(); return; }
  const url = new URL(req.url, "http://127.0.0.1");
  const action = url.searchParams.get("action");
  if (action === "inspect") { res.end(JSON.stringify({ counts, documents, customers })); return; }
  let body = "";
  for await (const chunk of req) body += chunk;
  let data = {};
  try { data = body ? JSON.parse(body) : {}; } catch { res.statusCode = 400; res.end("{}"); return; }
  counts[action] = (counts[action] || 0) + 1;
  let result;
  switch (action) {
    case "getCustomers": result = { success: true, data: customers }; break;
    case "getDocuments": result = { success: true, data: documents }; break;
    case "getDocument": result = { success: true, data: documents.find(doc => doc.id === url.searchParams.get("id")) }; break;
    case "getNextDocNumber": result = { success: true, docNumber: "2611-002" }; break;
    case "getItemSuggestions": result = { success: true, data: [{ description: "Example saved product", price: 12.5 }] }; break;
    case "createCustomer": {
      const id = "C-" + Date.now();
      customers.push({ ...data, id }); result = { success: true, id }; break;
    }
    case "createDocument":
    case "updateDocument": {
      // Deliberate delay exposes duplicate-click and busy states.
      await new Promise(resolve => setTimeout(resolve, 500));
      if (data.customerName === "Simulated failure") { result = { success: false, error: "Simulated save failure. Your input is retained." }; break; }
      const id = data.id || "DOC-" + Date.now();
      const docNumber = data.docNumber || "2611-002";
      const doc = { ...data, id, docNumber };
      documents = [doc, ...documents.filter(d => d.id !== id)];
      result = { success: true, docId: id, docNumber }; break;
    }
    case "deleteDocument":
    case "recoverDocument": {
      documents = documents.map(doc => doc.id === data.id ? { ...doc, status: action === "deleteDocument" ? "CANCELLED" : "PENDING" } : doc);
      result = { success: true }; break;
    }
    default: result = { success: false, error: "Unsupported fixture action" };
  }
  res.end(JSON.stringify(result));
});
server.listen(3031, "127.0.0.1", () => console.log("In-memory UI fixture API: http://127.0.0.1:3031"));
