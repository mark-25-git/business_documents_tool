# Development issue patterns

Record confirmed system issues and architecture changes chronologically, newest last.
Separate observed evidence from inference. Include status, affected area, date,
symptom, trigger, evidence, root cause, solution, verification, and limitations.
Exclude secrets, personal data, and routine cosmetic changes.

## 2026-11-03 — Remove retired assistant integrations

- Status: Resolved locally.
- Area: Runtime integrations, configuration, and maintenance scripts.
- User-visible issue: The invoice project still included unwanted Supabase and Telegram integrations.
- Trigger: Opening the project revealed a second database client and a Telegram assistant alongside the Google Sheets document workflow.
- Evidence: `lib/api.ts` uses Google Apps Script for customer and document operations. The separate bot routes, conversation store, AI extractor, and migration tools depended on Supabase or Telegram.
- Root cause: Retired assistant and migration code remained coupled to project configuration and dependencies.
- Solution: Remove bot and cleanup routes, assistant helpers, SQL schema, migration/test scripts, SDK dependency, and local integration environment settings. Keep the Google Sheets document API and browser PDF generation. Preserve pre-existing edits to three maintenance scripts under local backups.
- Verification: Production build passed, including lint and type validation; standalone TypeScript check passed; active app, library, scripts, and package files contain no integration references; Git whitespace check passed. The first sandboxed build could not fetch the existing Google font; the network-enabled build succeeded.
- Limitations: Local removal does not change existing deployments, remote database contents, bot registrations, webhook settings, or hosting environment variables. Historical backups remain local.

## 2026-11-03 — Mobile workspace and consistent draft snapshots

- Status: Implemented; final workflow checks recorded in the session.
- Area: Document UI, shared draft model, validation, and screen navigation.
- Symptom: Dense desktop item rows and an always-mounted PDF viewer made phone editing difficult. Loaded revision numbers could be compared against a different baseline format and appear unsaved.
- Trigger: A 390px viewport and a saved number with a revision suffix.
- Evidence: The old editor used a 12-column item row at all widths and compared the base document number to the full saved number.
- Root cause: Presentation, persistence handlers, and inconsistent saved snapshots lived together in one page.
- Solution: Separate Documents, Edit, and Preview screens around one shared draft; normalize loaded/saved snapshots; extract calculation, shipping, validation, and payload mapping; introduce shared Still Balanced controls and native modal sheets.
- Coverage: Pure model tests cover all five document types, tax virtual fields, free delivery, discounts, separate shipping, snapshots, revisions, zero values, and long item lists. A separate in-memory API supports write-flow checks without live sheet mutations.
- Limitations: Drafts survive screen changes but are not persisted across reloads. Hardware keyboard/safe-area/download tests remain necessary.

## 2026-11-03 — PDF preview without browser plugins

- Status: Resolved locally.
- Area: Cross-browser PDF rendering and worker build assets.
- Symptom: An embedded PDF iframe stayed blank in the in-app browser.
- Evidence: The generated blob existed and Open PDF was available, but the iframe had no visible document. Drawing that blob with PDF.js renders the document inside the page.
- Root cause: The iframe depended on browser PDF support. Next 14/SWC also transformed the PDF worker, producing duplicate identifiers or unresolved helper imports.
- Solution: Render the same exported PDF with PDF.js. Copy the exact installed worker into public assets during predev/prebuild so it is served unchanged and stays version matched.
- Coverage: Visible canvas rendering, page controls, zoom, accessible page text, worker syntax checks, and production compilation.
- Limitations: Old browser engines may need a separate compatibility pass. Native Open PDF and download links remain available.

## 2026-11-06 — Hydration mismatch with two local Next.js servers

- Status: Resolved locally.
- Symptom: The Documents page reported a missing button during hydration.
- Evidence: Port 3000 returned HTML with the old status filter and a page script with the newer item controls. Port 3001 returned matching HTML and JavaScript. Both Next.js processes ran from this checkout and shared its default `.next` directory.
- Resolution: Stopped the stale port 3000 process and kept the current server on port 3001. Run one dev server per checkout, or give separate servers separate build directories.
- Verification: A fresh Documents load showed 39 records with no browser errors. The editor and PDF preview also opened cleanly.
