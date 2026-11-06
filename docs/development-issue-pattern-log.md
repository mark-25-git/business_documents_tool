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

## 2026-11-06 — Native date field overflows on iPhone

- Status: Fixed. The user confirmed the visual fix on iPhone.
- Area: Shared floating-label date input.
- Symptom and trigger: A populated date field on iPhone Safari appeared taller and wider than adjacent inputs, with its value centered. The native picker opened normally.
- Evidence and cause: The shared field uses percentage width and padding. The iOS date appearance can apply content-box sizing and center the inner value. [WebKit reproduced the width issue with padded date inputs](https://bugs.webkit.org/show_bug.cgi?id=301648).
- Solution: Reset the date field appearance, use border-box sizing, and align the inner value with the label. Keep the HTML date input so the browser provides the picker.
- Verification: The populated field at 390px and the empty field at 320px both measured 58px high and matched their container widths in the desktop browser. TypeScript and document model tests passed.
- Device verification: The user confirmed the visual fix on iPhone after the change was pushed.

## 2026-11-06 — Document actions shows only a backdrop on iPhone

- Status: Fix implemented locally. Device verification pending.
- Area: Shared compact dialog used for document actions, confirmations, and item actions.
- Symptom and trigger: Tapping the document toolbar's three-dot button on iPhone darkened the screen without showing the actions.
- Evidence: The backdrop indicates that the native modal opened. The compact dialog combined `height: fit-content` on the dialog with `height: 100%` on its child. [WebKit documented that exact combination collapsing the child to zero height](https://bugs.webkit.org/show_bug.cgi?id=242837). The report matches the app's layout, but the failure was not reproduced on the affected device.
- Solution: Let the compact dialog's child size from its own content and inherit the dialog's viewport height cap.
- Verification: At 390px, desktop Chromium showed the document actions in a centered, content-sized panel. The cancellation confirmation opened and dismissed without changing the document.
