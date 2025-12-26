export type Customer = {
  id: string;
  name: string;
  phone: string;
  address: string;
  email: string;
  createdAt?: string;
};

export type LineItem = {
  id?: string;
  docId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

export type DocumentType = 'INVOICE' | 'QUOTATION' | 'RECEIPT' | 'DELIVERY_ORDER';

export type InvoiceDocument = {
  id: string;
  docNumber: string;
  type: DocumentType;
  date: string; // ISO date string
  customerId: string;
  customerName: string;
  totalAmount: number;
  status: string; // 'PAID', 'PENDING', 'DRAFT'
  notes?: string;
  items?: LineItem[];
};

export type CreateDocumentPayload = {
  type: DocumentType;
  date: string;
  customerId: string;
  customerName: string; // Denormalized for easier display
  totalAmount: number;
  status: string;
  notes?: string;
  items: LineItem[];
};



