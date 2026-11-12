const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

test("API text fields normalize numeric and empty spreadsheet cells before editing or PDF rendering", async () => {
  const responses = {
    getCustomers: [{ CustomerID: 42, Name: 123, Phone: 123456789, ShippingPhone: 0, Address: null }],
    getDocuments: [{ DocID: 1, DocNumber: 202611, CustomerID: 42, CustomerName: 123 }],
    getDocument: { DocID: 1, DocNumber: 202611, CustomerID: 42, CustomerName: 123,
      BillingPhone: 123456789, ShippingPhone: 0, Notes: null,
      items: [{ Description: 456, Quantity: 2, UnitPrice: 10, Amount: 20 }] },
    getItemSuggestions: [{ description: 456, price: "10" }],
  };
  const scope = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(require.resolve("../lib/api.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, {
    exports: scope.exports, module: scope, require, URL, console,
    process: { env: { NEXT_PUBLIC_GAS_API_URL: "https://example.test/api" } },
    fetch: async url => ({ ok: true, json: async () => ({ success: true, data: responses[new URL(url).searchParams.get("action")] }) }),
  });
  const api = scope.exports;
  const [customer] = await api.getCustomers(true);
  assert.equal(customer.id, "42");
  assert.equal(customer.name.trim(), "123");
  assert.equal(customer.phone.trim(), "123456789");
  assert.equal(customer.shippingPhone.trim(), "0");
  assert.equal(customer.address, "");
  const [listed] = await api.getDocuments(true);
  const doc = await api.getDocument(listed.id);
  assert.equal(doc.customerId, customer.id);
  assert.equal(doc.docNumber, "202611");
  assert.equal(doc.billingPhone.trim(), "123456789");
  assert.equal(doc.shippingPhone.trim(), "0");
  assert.equal(doc.notes, "");
  assert.equal(doc.items[0].description.trim(), "456");
  assert.equal(doc.items[0].amount, 20);
  const [suggestion] = await api.getItemSuggestions();
  assert.equal(suggestion.description.trim(), "456");
  assert.equal(suggestion.price, 10);
});
