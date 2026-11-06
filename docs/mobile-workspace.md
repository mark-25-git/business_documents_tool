# Mobile document workspace

The home screen lists documents with search and document-type filtering.
Open or create a document to edit customer details, items, delivery, and tax on one page.
Phones switch between Edit and Preview. At 1024px and wider, the editor and preview appear together.

## State and storage

- The existing Google Apps Script and Google Sheets API remains the storage backend.
- Query strings identify screens: `/`, `/?view=edit`, and `/?view=preview`. Saved documents also include `doc=<id>`; existing `/?doc=<id>` links still work.
- One shared editor hook owns the draft across these screen changes. Returning home retains the draft until replaced or the browser reloads.
- Explicit Save creates or updates a document. New customers are created only during Save. Master-profile updates remain opt-in.
- Opening another document or starting over confirms discarding unsaved changes. Browser reload/exit warns when there are edits.
- Tax remains a special `TAX:` line item. Delivery remains in the existing delivery fields and is included in the PDF as before.
- Cancel uses the existing recoverable delete operation. It does not permanently erase records.

## PDF preview

The existing React PDF document generates the PDF. Mozilla PDF.js draws that exact file into a canvas with page navigation and zoom.
The implementation follows [Mozilla's canvas rendering example](https://mozilla.github.io/pdf.js/examples/).
Open PDF and Download PDF use the same generated file.

`predev` and `prebuild` copy the installed PDF.js worker into `public/pdf.worker.mjs`.
This generated file is ignored by Git. Serving it unchanged avoids Next 14/SWC corrupting the worker or adding unresolved helper imports.
Keep the worker version synchronized with the library. The pinned PDF.js release requires Node 22.13 or later.

## Verification

Run model regression checks:

```text
node --test tests/document-model.test.cjs
npx tsc --noEmit --incremental false
npm run build
```

Do not run a production build into the active dev server's `.next` directory.
For this change, a separate source copy under ignored `build/mobile-check` was used.

For safe UI save/cancel/recovery tests, run `node tests/fixture-server.cjs` on port 3031.
Build or launch a separate app copy with `NEXT_PUBLIC_GAS_API_URL=http://127.0.0.1:3031`.
The fixture server stores data only in memory. Its `?action=inspect` response exposes action counts for duplicate-save checks.
The customer name `Simulated failure` makes document saves fail, allowing retry and input-retention testing.
Never point these write tests at the live sheet.

Real iPhone/Android checks are still required for keyboard positioning, safe areas, native download handling, and touch behavior.
The app remains a web app; no offline queue, persistent local drafts, install manifest, or service worker was added.

The online dependency audit reports pre-existing advisories in the older Next.js, jsPDF/html2pdf, PostCSS, Zod, and lint dependency trees.
No advisory was reported for the added PDF.js package. Dependency upgrades were kept outside this UI refactor.

## Results on 3 November 2026

- TypeScript check, production build, and all five model regression tests passed.
- No horizontal page overflow at 320, 390, 430, 768, and 1280px in the inspected flows.
- Live sheet reads verified document/customer loading; no write-flow tests used the live sheet.
- The isolated production app passed create, update, failed-save input retention/retry, cancellation/recovery, and new-customer creation. New customer IDs were reused by the saved document.
- A rapid double-click sent one update request. Fixture action counts confirmed two creates, three updates (including one intentional failure), one cancellation, one recovery, and one customer creation.
- A 50-item revision rendered as four PDF pages; page navigation and zoom worked.
- Customer-sheet Back dismissal, first-invalid-field focus, draft retention across Edit/Preview, and discard confirmation were checked.
- Shutting down the fixture API produced an explicit error and Try again action.
- The production test tab reported no browser errors before the intentional connection-failure test.
