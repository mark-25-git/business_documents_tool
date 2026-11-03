const fs = require("node:fs");
const path = require("node:path");
// Keep worker and library versions identical, without a third-party CDN.
const worker = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
const destination = path.join(__dirname, "..", "public", "pdf.worker.mjs");
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.copyFileSync(worker, destination);
