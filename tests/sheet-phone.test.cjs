const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("Sheets writes format only phone cells as text and preserve zeroes and empty values", () => {
  const scope = {};
  vm.runInNewContext(fs.readFileSync("google_apps_script_source/Code.js", "utf8"), scope);
  const calls = [];
  const sheet = { getRange: (row, column) => ({ setNumberFormat: format => calls.push([row, column, format]) }) };
  const values = ["012-3456789", 123456789, null, 25];
  scope.preparePhoneCells(sheet, ["phone", "billingphone", "shippingphone", "totalamount"], values, 2);
  assert.deepEqual(values, ["012-3456789", "123456789", "", 25]);
  assert.deepEqual(calls, [[2, 1, "@"], [2, 2, "@"], [2, 3, "@"]]);
});
