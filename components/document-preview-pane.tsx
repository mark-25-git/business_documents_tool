"use client";
import { useEffect, useMemo } from "react";
import { usePDF } from "@react-pdf/renderer";
import { Download, ExternalLink } from "lucide-react";
import { DocumentPDF, type PDFItem } from "./DocumentPDF";
import { PdfCanvas } from "./pdf-canvas";
import { calculate, documentLabels, shipping, type Draft } from "@/lib/document-model";

export default function DocumentPreviewPane({ draft, number, canDownload }: { draft: Draft; number: string; canDownload: boolean }) {
  const document = useMemo(() => {
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
  }, [draft, number]);
  const [instance, update] = usePDF({ document });
  useEffect(() => { update(document); }, [document, update]);
  const prefix = draft.type === "PROFORMA_INVOICE" ? "PI" : draft.type === "DELIVERY_ORDER" ? "DO" : draft.type[0];
  return <section className="preview-pane" aria-label="Document preview">
    {instance.error ? <div className="empty-state" role="alert"><h3>Preview could not be generated</h3><p>{instance.error}</p><button className="button button-outline" onClick={() => update(document)}>Try again</button></div>
      : instance.loading || !instance.url ? <div className="preview-loading" role="status"><div className="loading-dot" /><p>Preparing preview…</p></div>
      : <><div className="preview-actions">
        <span className="document-meta">{number}</span>
        <div className="toolbar-actions">
          <a className="button button-ghost button-icon" aria-label="Open PDF in a new tab" title="Open PDF" href={instance.url} target="_blank" rel="noreferrer"><ExternalLink size={19} /></a>
          {canDownload && <a className="button button-ghost button-icon" aria-label="Download PDF" title="Download PDF" href={instance.url} download={`${prefix}${number}.pdf`}><Download size={20} /></a>}
        </div>
      </div><PdfCanvas url={instance.url} />
        {!canDownload && <p className="preview-notice">Save the document to download the PDF.</p>}</>}
  </section>;
}
