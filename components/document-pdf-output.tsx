"use client";
import { pdf } from "@react-pdf/renderer";
import { DocumentPDF, type PDFItem } from "./DocumentPDF";
import { calculate, documentLabels, shipping, type Draft } from "@/lib/document-model";

export function createPdfDocument(draft: Draft, number: string) {
    const totals = calculate(draft);
    const ship = shipping(draft);
    const items: PDFItem[] = [...totals.items];
    if (draft.freeDelivery) items.push({ description: "Free Delivery", quantity: 1, unitPrice: 0, amount: 0, isFreeDeliveryCharge: true });
    else if (totals.delivery) items.push({ description: "Delivery Fee", quantity: 1, unitPrice: totals.delivery, amount: totals.delivery });
    return <DocumentPDF docType={documentLabels[draft.type].replace(/\b\w/g, c => c.toUpperCase())}
      docNumber={number || "Not assigned"} issueDate={draft.date}
      customer={draft.customer ? { name: draft.billingName, address: draft.billingAddress, phone: draft.billingPhone, email: draft.billingEmail,
        shippingName: ship.name, shippingAddress: ship.address, shippingPhone: ship.phone } : null}
      items={items} currency="MYR" imageUrl={`${window.location.origin}/company-chop.png`}
      isDeliveryOrder={draft.type === "DELIVERY_ORDER"} taxTitle={draft.taxEnabled ? draft.taxTitle : undefined}
      taxAmount={draft.taxEnabled ? totals.tax : undefined} showEmail={draft.showEmail} status={draft.status} />;
}

export function pdfFilename(draft: Draft, number: string) {
  const prefix = draft.type === "PROFORMA_INVOICE" ? "PI" : draft.type === "DELIVERY_ORDER" ? "DO" : draft.type[0];
  return `${prefix}${number}.pdf`;
}

export async function downloadDocumentPdf(draft: Draft, number: string) {
  const blob = await pdf(createPdfDocument(draft, number)).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = pdfFilename(draft, number);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
