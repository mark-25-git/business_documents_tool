const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
// Test the production TypeScript model without adding a test-runner dependency.
const moduleScope = { exports: {} };
const source = ts.transpileModule(fs.readFileSync(require.resolve("../lib/document-model.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const phoneScope = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve("../lib/phone.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: phoneScope.exports, module: phoneScope });
vm.runInNewContext(source, { exports: moduleScope.exports, module: moduleScope,
  require: name => name === "./phone" ? phoneScope.exports : require(name), Date });
const { newDraft, chooseCustomer, fromDocument, calculate, toPayload, fingerprint, validateDraft, splitNumber } = moduleScope.exports;
const customer = { id: "C-1", name: "Example company", address: "Billing address", phone: "0123456789", email: "example@example.com" };
const fixture = () => ({
  ...chooseCustomer(newDraft("2611-001"), customer),
  items: [{ description: "Product", quantity: 2, unitPrice: 100, amount: 200 }, { description: "Discount", quantity: 1, unitPrice: -10, amount: -10 }],
  deliveryFee: 15, taxEnabled: true, taxRate: 10,
});

test("all document types preserve the API payload, discount, delivery and tax virtual item", () => {
  for (const type of ["INVOICE", "QUOTATION", "RECEIPT", "DELIVERY_ORDER", "PROFORMA_INVOICE"]) {
    const d = { ...fixture(), type };
    const totals = calculate(d);
    assert.equal(totals.subtotal, 190);
    assert.equal(totals.tax, 19);
    assert.equal(totals.total, 224);
    const payload = toPayload(d, false);
    assert.equal(payload.type, type);
    assert.equal(payload.status, type === "INVOICE" ? "PENDING" : "DRAFT");
    assert.equal(payload.items.length, 3);
    assert.equal(payload.items[2].description, "TAX:SST 10%");
    assert.equal(payload.items[2].amount, 19);
    assert.equal(payload.totalAmount, 224);
    assert.equal(payload.shippingAddress, d.billingAddress);
  }
});
test("separate shipping, free delivery, manual tax and zero values survive", () => {
  const d = { ...fixture(), differentShipping: true, shippingName: "Recipient", shippingAddress: "Warehouse", shippingPhone: "0111111111",
    freeDelivery: true, taxManual: true, taxAmount: 0 };
  const payload = toPayload(d, true);
  assert.equal(payload.shippingName, "Recipient");
  assert.equal(payload.shippingAddress, "Warehouse");
  assert.equal(payload.deliveryFee, 0);
  assert.equal(payload.isFreeDelivery, true);
  assert.equal(payload.items.at(-1).amount, 0);
  assert.equal(payload.totalAmount, 190);
});
test("loading revisions and snapshots ignores later master-profile changes", () => {
  const doc = { ...toPayload(fixture(), true), id: "DOC-1", docNumber: "2611-001 (rev01)", status: "CANCELLED" };
  const d = fromDocument(doc, [{ ...customer, address: "New master address", name: "Changed master name" }]);
  assert.equal(d.number, "2611-001");
  assert.equal(d.suffix, "(rev01)");
  assert.equal(d.billingName, "Example company");
  assert.equal(d.billingAddress, "Billing address");
  assert.equal(toPayload(d, true).docNumber, "2611-001 (rev01)");
  assert.equal(toPayload(d, true).status, "CANCELLED");
  assert.equal(fingerprint(d), fingerprint({ ...d, items: d.items.map(i => ({ ...i, id: "backend-id" })) }));
  assert.notEqual(fingerprint(d), fingerprint({ ...d, showEmail: !d.showEmail }));
});
test("customer selection detects shipping differences and validation rejects invalid inputs", () => {
  const d = chooseCustomer(newDraft(), { ...customer, shippingAddress: "Another address" });
  assert.equal(d.differentShipping, true);
  assert.equal(validateDraft(d).items, "Add at least one item with a description.");
  assert.ok(validateDraft(newDraft()).customer);
  const errors = validateDraft({ ...fixture(), deliveryFee: -1, items: [{ description: "Product", quantity: 0, unitPrice: Infinity, amount: 0 }] });
  assert.ok(errors.deliveryFee);
  assert.ok(errors["quantity-0"]);
  assert.ok(errors["price-0"]);
});
test("decimal calculations and long item lists retain correct totals", () => {
  const d = { ...fixture(), items: Array.from({ length: 50 }, (_, i) => ({ description: "Item " + i, quantity: 0.5, unitPrice: 10, amount: 5 })) };
  assert.equal(calculate(d).total, 290);
  assert.equal(splitNumber("2611-001").suffix, "");
});

test("customer and saved-document phones format before appearing in fields", () => {
  const selected = chooseCustomer(newDraft(), { ...customer, phone: "123456789", shippingPhone: "+60377889900" });
  assert.equal(selected.billingPhone, "012-3456789");
  assert.equal(selected.shippingPhone, "03-77889900");
  const doc = { ...toPayload(fixture(), true), id: "DOC-1", docNumber: "2611-001",
    billingPhone: "123456789", shippingPhone: "601123456789" };
  const loaded = fromDocument(doc, []);
  assert.equal(loaded.billingPhone, "012-3456789");
  assert.equal(loaded.shippingPhone, "011-23456789");
  const payload = toPayload({ ...loaded, billingPhone: "123456789", shippingPhone: "+60377889900", differentShipping: true }, true);
  assert.equal(payload.billingPhone, "012-3456789");
  assert.equal(payload.shippingPhone, "03-77889900");
  assert.ok(validateDraft({ ...selected, billingPhone: "12345678" }).billingPhone);
  assert.ok(validateDraft({ ...selected, differentShipping: true, shippingPhone: "+60" }).shippingPhone);
  assert.equal(validateDraft({ ...selected, billingPhone: "+6581234567" }).billingPhone, undefined);
});
