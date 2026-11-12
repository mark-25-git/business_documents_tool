const fs = require("node:fs");
const ts = require("typescript");
const scope = { exports: {} };
const source = ts.transpileModule(fs.readFileSync("lib/phone.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
require("node:vm").runInNewContext(source, { exports: scope.exports, module: scope });
const { formatPhoneNumber } = scope.exports;


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
  { input: '12345678', expected: '01-2345678' },

  // Edge cases
  { input: 'abc123456789', expected: '012-3456789' },
  { input: '012-345-6789', expected: '012-3456789' },
];
for (const { input, expected } of testCases) {
  test(`format phone ${input}`, () => assert.equal(formatPhoneNumber(input), expected));
}
