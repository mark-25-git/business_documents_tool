import type { CreateDocumentPayload, Customer, DocumentType, InvoiceDocument, LineItem } from "./types";

export const documentLabels: Record<DocumentType, string> = {
  INVOICE: "Invoice", QUOTATION: "Quotation", RECEIPT: "Receipt", DELIVERY_ORDER: "Delivery order", PROFORMA_INVOICE: "Proforma invoice",
};
export const money = (value: number) => `RM ${Number(value).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
export function splitNumber(value: string) {
  const match = value.match(/^(.*?)\s*(\(rev\d*\))$/i);
  return { number: match ? match[1].trim() : value, suffix: match ? match[2] : "" };
}
export type Draft = {
  type: DocumentType; date: string; number: string; suffix: string; status: string; notes: string;
  customer: Customer | null; billingName: string; billingAddress: string; billingPhone: string; billingEmail: string;
  differentShipping: boolean; shippingName: string; shippingAddress: string; shippingPhone: string;
  showEmail: boolean; syncToMaster: boolean; items: LineItem[]; deliveryFee: number; freeDelivery: boolean;
  taxEnabled: boolean; taxTitle: string; taxRate: number; taxAmount: number; taxManual: boolean;
};
export const emptyItem = (): LineItem => ({ description: "", quantity: 1, unitPrice: 0, amount: 0 });
export function newDraft(number = ""): Draft {
  return { type: "INVOICE", date: localDate(), number, suffix: "", status: "DRAFT", notes: "", customer: null,
    billingName: "", billingAddress: "", billingPhone: "", billingEmail: "", differentShipping: false,
    shippingName: "", shippingAddress: "", shippingPhone: "", showEmail: true, syncToMaster: false,
    items: [emptyItem()], deliveryFee: 0, freeDelivery: false, taxEnabled: false, taxTitle: "SST 10%", taxRate: 10, taxAmount: 0, taxManual: false };
}
export function chooseCustomer(d: Draft, customer: Customer): Draft {
  const billingAddress = customer.billingAddress || customer.address || "";
  const billingPhone = customer.billingPhone || customer.phone || "";
  const billingEmail = customer.billingEmail || customer.email || "";
  const shippingName = customer.shippingName || customer.name;
  const shippingAddress = customer.shippingAddress || customer.address || "";
  const shippingPhone = customer.shippingPhone || customer.phone || "";
  return { ...d, customer, billingName: customer.name, billingAddress, billingPhone, billingEmail,
    showEmail: !!billingEmail, shippingName, shippingAddress, shippingPhone,
    differentShipping: shippingName !== customer.name || shippingAddress !== billingAddress || shippingPhone !== billingPhone };
}
export function fromDocument(doc: InvoiceDocument, customers: Customer[]): Draft {
  const tax = doc.items?.find(item => item.description.startsWith("TAX:"));
  const items = (doc.items || []).filter(item => !item.description.startsWith("TAX:"));
  return { ...newDraft(), ...splitNumber(doc.docNumber), type: doc.type, date: doc.date.split("T")[0], status: doc.status, notes: doc.notes || "",
    customer: customers.find(c => c.id === doc.customerId) || { id: doc.customerId, name: doc.customerName, address: doc.billingAddress || "", phone: doc.billingPhone || "", email: doc.billingEmail || "" },
    billingName: doc.customerName, billingAddress: doc.billingAddress || "", billingPhone: doc.billingPhone || "", billingEmail: doc.billingEmail || "",
    shippingName: doc.shippingName || doc.customerName, shippingAddress: doc.shippingAddress || doc.billingAddress || "", shippingPhone: doc.shippingPhone || doc.billingPhone || "",
    differentShipping: !!((doc.shippingName && doc.shippingName !== doc.customerName) || (doc.shippingAddress && doc.shippingAddress !== doc.billingAddress) || (doc.shippingPhone && doc.shippingPhone !== doc.billingPhone)),
    showEmail: !!doc.billingEmail, items: items.length ? items : [emptyItem()], deliveryFee: doc.deliveryFee || 0, freeDelivery: !!doc.isFreeDelivery,
    taxEnabled: !!tax, taxTitle: tax?.description.slice(4) || "SST 10%", taxAmount: tax?.amount || 0, taxManual: !!tax };
}
export function calculate(d: Draft) {
  const items = d.items.filter(item => item.description.trim());
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const delivery = d.freeDelivery ? 0 : d.deliveryFee;
  const tax = d.taxEnabled ? (d.taxManual ? d.taxAmount : Math.round(subtotal * d.taxRate) / 100) : 0;
  return { items, subtotal, delivery, tax, total: subtotal + delivery + tax };
}
export function shipping(d: Draft) {
  return d.differentShipping ? { name: d.shippingName, address: d.shippingAddress, phone: d.shippingPhone }
    : { name: d.billingName, address: d.billingAddress, phone: d.billingPhone };
}
export function toPayload(d: Draft, isExisting: boolean): CreateDocumentPayload {
  const totals = calculate(d);
  const ship = shipping(d);
  return { type: d.type, date: d.date, customerId: d.customer!.id, customerName: d.billingName,
    totalAmount: totals.total, status: isExisting ? d.status : d.type === "INVOICE" ? "PENDING" : "DRAFT", notes: d.notes,
    billingAddress: d.billingAddress, billingPhone: d.billingPhone, billingEmail: d.billingEmail,
    shippingName: ship.name, shippingAddress: ship.address, shippingPhone: ship.phone,
    deliveryFee: totals.delivery, isFreeDelivery: d.freeDelivery, syncToMaster: d.syncToMaster,
    items: [...totals.items, ...(d.taxEnabled ? [{ description: `TAX:${d.taxTitle}`, quantity: 1, unitPrice: totals.tax, amount: totals.tax }] : [])],
    docNumber: [d.number.trim(), d.suffix.trim()].filter(Boolean).join(" ") || undefined };
}
// Compare editable values, not backend item IDs or customer object identity.
export function fingerprint(d: Draft): string {
  return JSON.stringify({ ...d, customer: d.customer?.id || null,
    items: d.items.map(({ description, quantity, unitPrice, amount }) => ({ description, quantity, unitPrice, amount })) });
}
export type DraftErrors = Record<string, string>;
export function validateDraft(d: Draft): DraftErrors {
  const errors: DraftErrors = {};
  if (!d.customer) errors.customer = "Choose a customer first.";
  if (d.customer && !d.billingName.trim()) errors.billingName = "Enter the billing name.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) errors.date = "Choose a document date.";
  if (!d.items.some(item => item.description.trim())) errors.items = "Add at least one item with a description.";
  d.items.forEach((item, index) => {
    if (!item.description.trim() && (item.unitPrice !== 0 || item.quantity !== 1)) errors[`description-${index}`] = "Enter a description for this item.";
    if (item.description.trim() && (!Number.isFinite(item.quantity) || item.quantity <= 0)) errors[`quantity-${index}`] = "Quantity must be greater than zero.";
    if (!Number.isFinite(item.unitPrice)) errors[`price-${index}`] = "Enter a valid price.";
  });
  if (!Number.isFinite(d.deliveryFee) || d.deliveryFee < 0) errors.deliveryFee = "Enter a delivery fee of zero or more.";
  if (!Number.isFinite(d.taxAmount) || !Number.isFinite(d.taxRate) || d.taxRate < 0 || d.taxAmount < 0) errors.tax = "Enter a valid tax rate and amount.";
  return errors;
}
