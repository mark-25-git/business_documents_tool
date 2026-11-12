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
  const phoneScope = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve("../lib/phone.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports: phoneScope.exports, module: phoneScope });
  const writes = [];
  const source = ts.transpileModule(fs.readFileSync(require.resolve("../lib/api.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, {
    exports: scope.exports, module: scope,
    require: name => name === "./phone" ? phoneScope.exports : require(name), URL, console,
    process: { env: { NEXT_PUBLIC_GAS_API_URL: "https://example.test/api" } },
    fetch: async (url, options) => {
      if (options.body) writes.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ success: true, data: responses[new URL(url).searchParams.get("action")] }) };
    },
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
  const payload = { id: "C-1", phone: "123456789", billingPhone: "+601123456789", shippingPhone: "+65 8123 4567", totalAmount: 25 };
  await api.createCustomer(payload);
  await api.updateCustomer(payload);
  await api.createDocument(payload);
  await api.updateDocument("DOC-1", payload);
  assert.equal(writes.length, 4);
  for (const body of writes) {
    assert.equal(body.phone, "'012-3456789");
    assert.equal(body.billingPhone, "'011-23456789");
    assert.equal(body.shippingPhone, "'+6581234567");
    assert.equal(body.totalAmount, 25);
  }
  assert.equal(payload.phone, "123456789");
});
