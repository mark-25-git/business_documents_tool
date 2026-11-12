const fs = require("node:fs");
const ts = require("typescript");
const scope = { exports: {} };
const source = ts.transpileModule(fs.readFileSync("lib/phone.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
require("node:vm").runInNewContext(source, { exports: scope.exports, module: scope });
const { formatPhoneNumber, phoneError, phoneForSheet } = scope.exports;


const { test } = require("node:test");
const assert = require("node:assert/strict");
const testCases = [
  // Mobile Numbers (01x) - 9 digits
  { input: '0123456789', expected: '012-3456789' },
  { input: '016-1234567', expected: '016-1234567' },
  { input: '019 9876543', expected: '019-9876543' },
  { input: '017 555-1234', expected: '017-5551234' },
  { input: '(011) 23456789', expected: '011-23456789' },
  { input: '+60123456789', expected: '012-3456789' },
  { input: '+60 16 123 4567', expected: '016-1234567' },
  { input: '60199876543', expected: '019-9876543' },

  // Mobile Numbers (01x) - 10 digits
  { input: '01234567890', expected: '012-34567890' },
  { input: '016-12345678', expected: '016-12345678' },
  { input: '+601234567890', expected: '012-34567890' },
  { input: '601234567890', expected: '012-34567890' },

  // Fixed Line - 2-digit area code (03, 04, 07) - 8 digits
  { input: '0377889900', expected: '03-77889900' },
  { input: '04 1234567', expected: '04-1234567' },
  { input: '07-5551212', expected: '07-5551212' },
  { input: '+60 3 7788 9900', expected: '03-77889900' },
  { input: '6075551212', expected: '07-5551212' },

  // Fixed Line - 2-digit area code - 9 digits
  { input: '03778899001', expected: '03-778899001' },
  { input: '04 12345678', expected: '04-12345678' },

  // Fixed Line - 3-digit area code (088, 089) - 8 digits
  { input: '0881234567', expected: '088-1234567' },
  { input: '(088) 123 4567', expected: '088-1234567' },
  { input: '+60 88 123 4567', expected: '088-1234567' },
  { input: '60881234567', expected: '088-1234567' },

  // Fixed Line - 3-digit area code (088, 089) - 9 digits
  { input: '08812345678', expected: '088-12345678' },
  { input: '08912345678', expected: '089-12345678' },

  // Partial inputs
  { input: '012', expected: '012' },
  { input: '0123', expected: '0123' },
  { input: '03', expected: '03' },
  { input: '088', expected: '088' },

  // Missing leading 0
  { input: '1234567890', expected: '012-34567890' },
  { input: '123456789', expected: '012-3456789' },
  { input: '12345678', expected: '012-345678' },

  // Edge cases
  { input: 'abc123456789', expected: '012-3456789' },
  { input: '012-345-6789', expected: '012-3456789' },
];
for (const { input, expected } of testCases) {
  test(`format phone ${input}`, () => assert.equal(formatPhoneNumber(input), expected));
  test(`format stays stable for ${input}`, () => assert.equal(formatPhoneNumber(formatPhoneNumber(input)), expected));
}

const completeNumbers = [
  ...Array.from({ length: 10 }, (_, i) => `01${i}${i === 1 ? "23456789" : "2345678"}`),
  "0377889900", "041234567", "051234567", "061234567", "075551212",
  "082123456", "091234567", "0881234567", "0891234567",
];
for (const local of completeNumbers) {
  const expected = formatPhoneNumber(local);
  for (const input of [local, local.slice(1), `60${local.slice(1)}`, `+60${local.slice(1)}`]) {
    test(`typing and pasting ${input} produce the same local format`, () => {
      let value = "";
      for (const character of input) value = formatPhoneNumber(value + character);
      assert.equal(value, expected);
      assert.equal(formatPhoneNumber(input), expected);
    });
  }
}
test("partial country codes survive typing until the number can be normalized", () => {
  for (const input of ["+", "+6", "+60", "+601", "+60123456", "60", "60123456"]) {
    assert.equal(formatPhoneNumber(input), input);
  }
});

for (const input of ["+6581234567", "+442079460123", "+14155552671", "+628123456789", "+8613812345678"]) {
  test(`international country code remains intact for ${input}`, () => {
    let value = "";
    for (const character of input) value = formatPhoneNumber(value + character);
    assert.equal(value, input);
    assert.equal(formatPhoneNumber(input), input);
    assert.equal(phoneError(input), undefined);
    assert.equal(phoneForSheet(input), "'" + input);
  });
}
test("saving requires complete Malaysian mobile numbers and preserves landlines", () => {
  for (const input of ["123456789", "0123456789", "01123456789", "+60123456789", "0377889900", "075551212", "0881234567", ""]) {
    assert.equal(phoneError(input), undefined, input);
  }
  for (const input of ["12345678", "0123", "012345678901", "+", "+60", "+601", "+65"]) {
    assert.ok(phoneError(input), input);
  }
});
test("Sheets text prefix appears exactly once and stays out of the displayed number", () => {
  assert.equal(phoneForSheet("123456789"), "'012-3456789");
  assert.equal(phoneForSheet("'012-3456789"), "'012-3456789");
  assert.equal(formatPhoneNumber("'+6581234567"), "+6581234567");
  assert.equal(phoneForSheet(null), "");
  assert.equal(phoneForSheet(""), "");
});
