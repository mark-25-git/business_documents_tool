# Solved Problems

## Tax Persistence without Backend Schema Changes
- **Problem**: Need to store tax title and amount on a per-document basis, but the user requested no changes to the Google Apps Script backend or Google Sheets columns.
- **Root Cause**: The current `Documents` sheet does not have dedicated columns for tax components.
- **Solution**: Implemented a "virtual" field strategy by persisting tax information as a special line item with a `TAX:` prefix (e.g., `TAX:SST 10%`). Updated the document viewer and PDF generation logic to detect these special items, pull them out of the main items list, and render them correctly in the totals section. This preserves the functional integrity of the document while keeping the storage layer unchanged.

## Multiline Input Support in Simple Forms
- **Problem**: Standard `Input` fields in both the standard and simple document forms were truncating long product descriptions.
- **Root Cause**: HTML `<input type="text">` is single-line by design.
- **Solution**: Created a reusable `Textarea` component matching the project's styling and updated all document creation and viewing forms to use it for descriptions. Ensured `@react-pdf/renderer` logic correctly handles text wrapping for these multiline strings in the final PDF.
