"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { getDocument, getCustomers } from "@/lib/api";
import { InvoiceDocument, Customer } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DocumentPDF } from "@/components/DocumentPDF";
import { pdf } from '@react-pdf/renderer';

// Dynamically import PDFViewer for client-side preview
const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then(mod => mod.PDFViewer),
  { ssr: false }
);

// Document type labels (sentence case)
const documentTypeLabels: Record<string, string> = {
  INVOICE: "Invoice",
  QUOTATION: "Quotation",
  RECEIPT: "Receipt",
  DELIVERY_ORDER: "Delivery Order",
};

export default function DocumentViewPage() {
  const params = useParams();
  const [doc, setDoc] = React.useState<InvoiceDocument | null>(null);
  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (params.id) {
      getDocument(params.id as string).then(data => {
        setDoc(data);
        if (data) {
          // Fetch customer details if available
          getCustomers().then(customers => {
            const found = customers.find(c => c.id === data.customerId);
            if (found) {
              setCustomer(found);
            }
            setLoading(false);
          }).catch(() => {
            setLoading(false);
          });
        } else {
          setLoading(false);
        }
      });
    }
  }, [params.id]);

  // Calculate totals
  const baseItems = React.useMemo(
    () => (doc?.items || []).filter(i => i.description.trim() !== "" && !i.description.toLowerCase().includes('delivery')),
    [doc?.items]
  );

  const deliveryItem = React.useMemo(
    () => (doc?.items || []).find(i =>
      i.description.toLowerCase().includes('delivery') ||
      i.description.toLowerCase().includes('free delivery')
    ),
    [doc?.items]
  );

  const isFreeDelivery = deliveryItem?.description.toLowerCase().includes('free delivery') || false;
  const deliveryFee = deliveryItem?.amount || 0;

  const subtotal = baseItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalAmount = doc?.totalAmount || 0;

  // Shared PDF document for preview/download
  const imageUrl = React.useMemo(
    () => (typeof window !== 'undefined' ? `${window.location.origin}/company-chop.png` : '/company-chop.png'),
    []
  );

  // Helper for delivery order detection
  const isDocTypeDO = (type: string) =>
    type.toUpperCase().includes('DELIVERY') || type.toUpperCase().includes('D.O') || type.toUpperCase() === 'DO';

  const pdfDocument = React.useMemo(() => {
    if (!doc) return null;
    return (
      <DocumentPDF
        docType={documentTypeLabels[doc.type] || doc.type}
        docNumber={doc.docNumber}
        issueDate={doc.date}
        customer={{
          name: doc.customerName,
          phone: doc.billingPhone || customer?.phone || "",
          address: doc.billingAddress || customer?.address || "",
          shippingName: doc.shippingName,
          shippingAddress: doc.shippingAddress,
          shippingPhone: doc.shippingPhone,
        }}
        items={doc.items || []}
        currency="MYR"
        imageUrl={imageUrl}
        isDeliveryOrder={doc.type === 'DELIVERY_ORDER' || isDocTypeDO(doc.type)}
      />
    );
  }, [doc, customer, imageUrl]);

  // Generate document prefix for filename
  const getDocumentPrefix = (docType: string): string => {
    if (isDocTypeDO(docType)) {
      return 'DO';
    }
    return docType.charAt(0); // First letter: I, Q, R
  };

  // Dynamic page title (must be before conditional returns)
  const pageTitle = React.useMemo(() => {
    if (!doc) return 'Document Details';
    const formattedType = documentTypeLabels[doc.type] || doc.type;
    const customerName = customer?.name || doc.customerName;
    return `${formattedType} ${doc.docNumber}${customerName ? ` - ${customerName}` : ''}`;
  }, [doc, customer]);

  // Download PDF with specific document type
  const downloadPDF = async (docType?: string) => {
    if (!doc) return;

    // Use provided type or current document type
    const targetType = docType || doc.type;
    // Use original date if same type, current date if different type
    const issueDate = (targetType === doc.type) ? doc.date : new Date().toISOString().split('T')[0];

    try {
      // Create PDF document with selected type and current date
      const pdfDoc = (
        <DocumentPDF
          docType={documentTypeLabels[targetType] || targetType}
          docNumber={doc.docNumber}
          issueDate={issueDate}
          customer={{
            name: doc.customerName,
            phone: doc.billingPhone || customer?.phone || "",
            address: doc.billingAddress || customer?.address || "",
            shippingName: doc.shippingName,
            shippingAddress: doc.shippingAddress,
            shippingPhone: doc.shippingPhone,
          }}
          items={doc.items || []}
          currency="MYR"
          imageUrl={imageUrl}
          isDeliveryOrder={targetType === 'DELIVERY_ORDER' || isDocTypeDO(targetType)}
        />
      );

      const blob = await pdf(pdfDoc).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Use appropriate prefix for the target type
      const prefix = getDocumentPrefix(targetType);
      const filename = `${prefix}${doc.docNumber}.pdf`;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading document...</div>;
  if (!doc) return <div className="p-8 text-center text-red-500">Document not found</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 pb-24">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between no-print">
          <div className="flex items-center gap-4">
            <Link href="/documents" className="p-2 hover:bg-gray-200 rounded-full">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
          </div>
          <Button variant="outline" onClick={() => downloadPDF()}>
            <Download className="h-4 w-4 mr-2" /> Download {documentTypeLabels[doc.type]}
          </Button>
        </div>

        {/* Form and Preview Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Main Form */}
          <Card className="border-none shadow-lg no-print">
            <CardContent className="p-8 space-y-6">

              {/* Document Type Selection (Download Buttons) */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-500 block mb-2">Document type</label>
                <div className="flex gap-2 flex-wrap">
                  {(['INVOICE', 'QUOTATION', 'RECEIPT', 'DELIVERY_ORDER'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => downloadPDF(t)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${doc.type === t
                        ? 'bg-primary text-primary-foreground hover:opacity-90'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      Download {documentTypeLabels[t]}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Current type: <span className="font-medium">{documentTypeLabels[doc.type]}</span> • Downloads use current date
                </p>
              </div>

              {/* Document ID & Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-500 block mb-2">
                    Document number
                  </label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-900">
                    {doc.docNumber}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-500 block mb-2">
                    Date
                  </label>
                  <Input
                    type="date"
                    value={doc.date.split('T')[0]}
                    disabled
                    className="w-full bg-gray-50"
                  />
                </div>
              </div>

              {/* Customer Selection (Display Only) */}
              <div className="space-y-4">
                <label className="text-sm font-semibold text-gray-500 block mb-2">Customer Details</label>

                {/* Billing Card */}
                <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
                  <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Billing Details</div>
                  <div className="font-bold text-lg text-gray-900">{doc.customerName}</div>
                  <div className="text-gray-600 text-sm mt-1">{doc.billingPhone || customer?.phone}</div>
                  <div className="text-gray-600 text-sm">{doc.billingAddress || customer?.address}</div>
                  {doc.billingEmail && <div className="text-gray-600 text-sm">{doc.billingEmail}</div>}
                </div>

                {/* Shipping Card (Show whenever shipping info is unique) */}
                {(() => {
                  const sName = (doc.shippingName || "").trim();
                  const sAddr = (doc.shippingAddress || "").trim();
                  const sPhone = (doc.shippingPhone || "").trim();

                  const bName = (doc.customerName || "").trim();
                  const bAddr = (doc.billingAddress || customer?.address || "").trim();
                  const bPhone = (doc.billingPhone || customer?.phone || "").trim();

                  const hasUniqueName = sName !== "" && sName !== bName;
                  const hasUniqueAddress = sAddr !== "" && sAddr !== bAddr;
                  const hasUniquePhone = sPhone !== "" && sPhone !== bPhone;

                  // Show if ANY field is unique
                  const shouldShowShipping = hasUniqueName || hasUniqueAddress || hasUniquePhone;

                  if (!shouldShowShipping) return null;

                  return (
                    <div className="p-4 bg-blue-50/50 rounded-md border border-blue-100 animate-in fade-in slide-in-from-top-1">
                      <div className="text-[10px] font-bold text-blue-500 uppercase mb-2">Shipping Details</div>
                      <div className="font-bold text-gray-900">{sName || bName}</div>
                      <div className="text-gray-600 text-sm mt-1">{sPhone || bPhone}</div>
                      <div className="text-gray-600 text-sm">{sAddr || bAddr}</div>
                    </div>
                  );
                })()}
              </div>

              {/* Line Items (Display Only) */}
              <div className="space-y-4">
                <label className="text-sm font-semibold text-gray-500 block mb-2">Items</label>
                {baseItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-6">
                      <Input
                        value={item.description}
                        disabled
                        className="bg-gray-50"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        value={item.quantity || ''}
                        disabled
                        className="bg-gray-50"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        value={item.unitPrice || ''}
                        disabled
                        className="bg-gray-50"
                      />
                    </div>
                    <div className="col-span-2 flex items-center">
                      <div className="flex-1 text-right font-medium text-sm">
                        RM {item.amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Delivery Fee Section (Display Only) */}
              {(deliveryFee > 0 || isFreeDelivery) && (
                <div className="border-t pt-4 space-y-3">
                  <label className="text-sm font-semibold text-gray-500 block mb-2">Delivery</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-default">
                      <input
                        type="checkbox"
                        checked={isFreeDelivery}
                        disabled
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">Free Delivery</span>
                    </label>
                    {!isFreeDelivery && deliveryFee > 0 && (
                      <div className="flex-1 max-w-xs">
                        <Input
                          type="number"
                          value={deliveryFee || ''}
                          disabled
                          className="bg-gray-50"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Totals */}
              <div className="border-t pt-4">
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="font-medium">RM {subtotal.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    {!isFreeDelivery && deliveryFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Delivery Fee</span>
                        <span className="font-medium">RM {deliveryFee.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center border-t pt-2">
                      <span className="font-bold text-gray-900">Total</span>
                      <span className="font-bold text-2xl text-primary">
                        RM {totalAmount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Preview Section */}
          <div className="no-print">
            <Card className="border-none shadow-md sticky top-6">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Preview</h2>
                  <div className="text-sm text-gray-500">{doc.docNumber}</div>
                </div>
                {pdfDocument && (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <PDFViewer width="100%" height={900} showToolbar={true}>
                      {pdfDocument}
                    </PDFViewer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}



