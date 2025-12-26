"use client";

import * as React from "react";
import dynamic from 'next/dynamic';
import { DocumentPDF } from "@/components/DocumentPDF";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
import { pdf } from '@react-pdf/renderer';

// Dynamically import PDFViewer (web-only, must be client-side)
const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFViewer),
  { ssr: false }
);

const mockCustomer = {
  name: "John Doe",
  phone: "012-3456789",
  address: "123 Sample Street\nMuar, Johor",
};

const mockItems = [
  { description: "Stool 18", quantity: 2, unitPrice: 120, amount: 240 },
  { description: "Table 24", quantity: 1, unitPrice: 350, amount: 350 },
  { description: "Chair Set", quantity: 4, unitPrice: 85, amount: 340 },
  { description: "Delivery Fee", quantity: 1, unitPrice: 20, amount: 20 },
];

export default function LayoutPreviewPage() {
  const today = new Date().toISOString().split("T")[0];
  const [isDownloading, setIsDownloading] = React.useState(false);
  const imageUrl = typeof window !== 'undefined' ? `${window.location.origin}/company-chop.png` : '/company-chop.png';
  
  // Create the PDF document component (same one used for download)
  const pdfDocument = (
    <DocumentPDF
      docType="Invoice"
      docNumber="2504-001"
      issueDate={today}
      customer={mockCustomer}
      items={mockItems}
      currency="MYR"
      imageUrl={imageUrl}
    />
  );

  // Download PDF using react-pdf for proper text extraction
  const downloadPDF = async () => {
    try {
      setIsDownloading(true);

      // Generate PDF blob using the same document component
      const blob = await pdf(pdfDocument).toBlob();
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'I2504-001.pdf';
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      setIsDownloading(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setIsDownloading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between no-print">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Document Layout Preview (Mock)</h1>
            <p className="text-gray-600 text-sm mt-1">
              This page shows the document layout with mock data for quick review.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => window.print()} variant="outline">
              <Printer className="h-4 w-4 mr-2" /> Print Preview
            </Button>
            <Button onClick={downloadPDF} disabled={isDownloading}>
              <Download className="h-4 w-4 mr-2" /> 
              {isDownloading ? "Downloading..." : "Download PDF"}
            </Button>
          </div>
        </div>

        {/* PDF Viewer - renders the exact same component that gets downloaded */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <PDFViewer 
            width="100%" 
            height={800}
            showToolbar={true}
          >
            {pdfDocument}
          </PDFViewer>
        </div>
      </div>
    </main>
  );
}

