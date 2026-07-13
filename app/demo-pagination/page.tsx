"use client";

import React from "react";
import dynamic from "next/dynamic";
import { DocumentPDF } from "@/components/DocumentPDF";

// Dynamically import PDFViewer to disable Server-Side Rendering (SSR) for this page
const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFViewer),
  { ssr: false }
);

const mockCustomer = {
  name: "Mock Customer Enterprise",
  phone: "013-3500093",
  address: "123, Mockingbird Lane, Technology Park, 57000 Kuala Lumpur",
  email: "customer@mockenterprise.com",
  shippingName: "Mock Customer Warehouse",
  shippingAddress: "456, Delivery Boulevard, Port Klang, 42000 Selangor",
  shippingPhone: "013-9876543",
};

const mockItems = [
  { description: "Star Penyidai Sejadah (Warna: Cappuccino)", quantity: 5, unitPrice: 43.00, amount: 215.00 },
  { description: "Almari MDF 4 Pintu (Warna: Dark Coco)", quantity: 2, unitPrice: 350.00, amount: 700.00 },
  { description: "Meja Makan Solid Wood (Warna: Walnut)", quantity: 1, unitPrice: 1200.00, amount: 1200.00 },
  { description: "Kerusi Pejabat Ergonomik (Warna: Hitam)", quantity: 10, unitPrice: 280.00, amount: 2800.00 },
  { description: "Rak Buku 5 Tingkat (Warna: Oak)", quantity: 4, unitPrice: 150.00, amount: 600.00 },
  { description: "Sofa L-Shape 3 Tempat Duduk (Warna: Kelabu)", quantity: 1, unitPrice: 1850.00, amount: 1850.00 },
  { description: "Kabinet Dapur Aluminium (Warna: Putih)", quantity: 1, unitPrice: 2400.00, amount: 2400.00 },
  { description: "Katil Queen Size dengan Tilam (Warna: Cappuccino)", quantity: 2, unitPrice: 1100.00, amount: 2200.00 },
  { description: "Meja Belajar Kanak-Kanak (Warna: Merah Jambu)", quantity: 3, unitPrice: 180.00, amount: 540.00 },
  { description: "Loker Besi 6 Pintu (Warna: Abu-Abu)", quantity: 2, unitPrice: 450.00, amount: 900.00 },
  { description: "Meja Kopi Kaca (Warna: Hitam)", quantity: 1, unitPrice: 320.00, amount: 320.00 },
  { description: "Kabinet TV Kayu (Warna: Jati)", quantity: 1, unitPrice: 750.00, amount: 750.00 },
  { description: "Penyidai Baju Stainless Steel", quantity: 6, unitPrice: 85.00, amount: 510.00 },
  { description: "Kerusi Plastik Sandar Standard (Warna: Biru)", quantity: 50, unitPrice: 15.00, amount: 750.00 },
  { description: "Meja Lipat Banquet 3x3", quantity: 12, unitPrice: 65.00, amount: 780.00 },
  { description: "Laci Plastik 4 Tingkat (Warna: Pastel)", quantity: 5, unitPrice: 45.00, amount: 225.00 },
  { description: "Cermin Dinding Panjang (Warna: Putih)", quantity: 3, unitPrice: 95.00, amount: 285.00 },
  { description: "Penyangkut Baju Berdiri Kayu", quantity: 8, unitPrice: 55.00, amount: 440.00 },
  { description: "Tilam Single Foam Standard", quantity: 15, unitPrice: 90.00, amount: 1350.00 },
  { description: "Kabinet Kasut 3 Pintu (Warna: Coklat)", quantity: 4, unitPrice: 120.00, amount: 480.00 },
  { description: "Meja Konsol Hiasan (Warna: Emas/Putih)", quantity: 1, unitPrice: 580.00, amount: 580.00 },
  { description: "Kerusi Bar Besi Melaraskan Tinggi", quantity: 4, unitPrice: 165.00, amount: 660.00 },
  { description: "Papan Kenyataan Gabus 3x4", quantity: 2, unitPrice: 75.00, amount: 150.00 },
  { description: "Kabinet Fail Pejabat Beroda", quantity: 3, unitPrice: 210.00, amount: 630.00 },
  { description: "Rak Kasut Stainless Steel 5 Tingkat", quantity: 7, unitPrice: 48.00, amount: 336.00 }
];

export default function DemoPaginationPage() {
  const imageUrl = typeof window !== "undefined" ? `${window.location.origin}/company-chop.png` : "/company-chop.png";

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <PDFViewer style={{ width: "100%", height: "100%" }}>
        <DocumentPDF
          docType="Invoice"
          docNumber="2606-999"
          issueDate={new Date().toISOString()}
          customer={mockCustomer}
          items={mockItems}
          currency="MYR"
          imageUrl={imageUrl}
          isDeliveryOrder={false}
          taxTitle="SST 10%"
          taxAmount={2103.10}
          showEmail={true}
        />
      </PDFViewer>
    </div>
  );
}
