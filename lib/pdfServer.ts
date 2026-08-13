import React from "react";
import { pdf } from "@react-pdf/renderer";
import { DocumentPDF } from "../components/DocumentPDF";
import { DraftCustomer, DraftItem } from "./jobStore";

export async function generateInvoicePdfBuffer(params: {
  docNumber: string;
  issueDate: string;
  customer: DraftCustomer | null;
  items: DraftItem[];
}): Promise<Buffer> {
  try {
    const formattedCustomer = params.customer
      ? {
          name: params.customer.name || "Customer",
          phone: params.customer.phone || "",
          address: params.customer.address || "",
          email: params.customer.email || "",
          shippingName: params.customer.name || "",
          shippingAddress: params.customer.address || "",
          shippingPhone: params.customer.phone || "",
        }
      : null;

    const formattedItems = params.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount || item.quantity * item.unitPrice,
    }));

    const pdfElement = React.createElement(DocumentPDF, {
      docType: "INVOICE",
      docNumber: params.docNumber,
      issueDate: params.issueDate,
      customer: formattedCustomer,
      items: formattedItems,
      currency: "RM",
      isDeliveryOrder: false,
    });

    const instance = pdf(pdfElement as any);
    const buffer = await instance.toBuffer();
    return buffer as unknown as Buffer;
  } catch (error) {
    console.error("Error generating PDF in pdfServer:", error);
    throw error;
  }
}
