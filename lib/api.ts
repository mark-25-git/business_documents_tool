import { CreateDocumentPayload, Customer, InvoiceDocument, DocumentType } from "./types";

const GAS_URL = process.env.NEXT_PUBLIC_GAS_API_URL || "";

async function fetchGasApi<T>(
  action: string,
  options?: { method?: string; body?: any; params?: Record<string, string> }
): Promise<T | null> {
  try {
    if (!GAS_URL) {
      console.error("NEXT_PUBLIC_GAS_API_URL environment variable is not defined");
      return null;
    }

    const url = new URL(GAS_URL);
    url.searchParams.set("action", action);
    if (options?.params) {
      Object.entries(options.params).forEach(([key, val]) => {
        url.searchParams.set(key, val);
      });
    }

    const fetchOpts: RequestInit = {
      cache: "no-store",
    };

    if (options?.method && options.method.toUpperCase() === "POST") {
      fetchOpts.method = "POST";
      fetchOpts.body = JSON.stringify(options.body || {});
    }

    const res = await fetch(url.toString(), fetchOpts);
    if (!res.ok) {
      console.error(`GAS API HTTP error for ${action}: ${res.status}`);
      return null;
    }
    const json = await res.json();
    return json;
  } catch (error) {
    console.error(`Failed GAS API request for ${action}:`, error);
    return null;
  }
}

export async function getCustomers(strict = false): Promise<Customer[]> {
  try {
    const result = await fetchGasApi<{ success: boolean; data: any[] }>("getCustomers");
    if (strict && (!result?.success || !Array.isArray(result.data))) throw new Error("Could not load customers. Check your connection and retry.");
    if (!result || !result.success || !Array.isArray(result.data)) {
      return [];
    }

    return result.data.map((c) => ({
      id: c.id || c.CustomerID,
      name: c.name || c.Name || "",
      phone: c.phone || c.Phone || "",
      address: c.address || c.Address || "",
      email: c.email || c.Email || "",
      billingAddress: c.billingAddress || c.BillingAddress || c.address || c.Address || "",
      billingPhone: c.billingPhone || c.BillingPhone || c.phone || c.Phone || "",
      billingEmail: c.billingEmail || c.BillingEmail || c.email || c.Email || "",
      shippingName: c.shippingName || c.ShippingName || c.name || c.Name || "",
      shippingAddress: c.shippingAddress || c.ShippingAddress || c.address || c.Address || "",
      shippingPhone: c.shippingPhone || c.ShippingPhone || c.phone || c.Phone || "",
      createdAt: c.createdAt || c.CreatedAt,
    }));
  } catch (error) {
    console.error("Failed to fetch customers:", error);
    if (strict) throw error;
    return [];
  }
}

export async function createCustomer(data: Omit<Customer, "id">) {
  try {
    const result = await fetchGasApi<{ success: boolean; id?: string; error?: string }>("createCustomer", {
      method: "POST",
      body: data,
    });

    if (!result || !result.success) {
      return { success: false, error: result?.error || "Failed to create customer" };
    }

    return { success: true, id: result.id };
  } catch (error: any) {
    console.error("Failed to create customer:", error);
    return { success: false, error: error.message || error.toString() };
  }
}

export async function updateCustomer(data: Customer) {
  try {
    const result = await fetchGasApi<{ success: boolean; error?: string }>("updateCustomer", {
      method: "POST",
      body: data,
    });

    if (!result || !result.success) {
      return { success: false, error: result?.error || "Failed to update customer" };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to update customer:", error);
    return { success: false, error: error.message || error.toString() };
  }
}

export async function getDocuments(strict = false): Promise<InvoiceDocument[]> {
  try {
    const result = await fetchGasApi<{ success: boolean; data: any[] }>("getDocuments");
    if (strict && (!result?.success || !Array.isArray(result.data))) throw new Error("Could not load documents. Check your connection and retry.");
    if (!result || !result.success || !Array.isArray(result.data)) {
      return [];
    }

    return result.data.map((d) => ({
      id: d.id || d.DocID,
      docNumber: d.docNumber || d.DocNumber,
      type: (d.type || d.Type) as DocumentType,
      date: d.date || d.Date,
      customerId: d.customerId || d.CustomerID,
      customerName: d.customerName || d.CustomerName,
      totalAmount: Number(d.totalAmount || d.TotalAmount || 0),
      status: d.status || d.Status,
      deliveryFee: Number(d.deliveryFee || d.DeliveryFee || 0),
      isFreeDelivery: Boolean(d.isFreeDelivery || d.IsFreeDelivery || false),
    }));
  } catch (error) {
    console.error("Failed to fetch documents:", error);
    if (strict) throw error;
    return [];
  }
}

export async function getDocument(id: string): Promise<InvoiceDocument | null> {
  try {
    const result = await fetchGasApi<{ success: boolean; data: any }>("getDocument", {
      params: { id },
    });

    if (!result || !result.success || !result.data) {
      return null;
    }

    const doc = result.data;
    return {
      id: doc.id || doc.DocID,
      docNumber: doc.docNumber || doc.DocNumber,
      type: (doc.type || doc.Type) as DocumentType,
      date: doc.date || doc.Date,
      customerId: doc.customerId || doc.CustomerID,
      customerName: doc.customerName || doc.CustomerName,
      totalAmount: Number(doc.totalAmount || doc.TotalAmount || 0),
      status: doc.status || doc.Status,
      notes: doc.notes || doc.Notes || "",
      billingAddress: doc.billingAddress || doc.BillingAddress || "",
      billingPhone: doc.billingPhone || doc.BillingPhone || "",
      billingEmail: doc.billingEmail || doc.BillingEmail || "",
      shippingName: doc.shippingName || doc.ShippingName || "",
      shippingAddress: doc.shippingAddress || doc.ShippingAddress || "",
      shippingPhone: doc.shippingPhone || doc.ShippingPhone || "",
      deliveryFee: Number(doc.deliveryFee || doc.DeliveryFee || 0),
      isFreeDelivery: Boolean(doc.isFreeDelivery || doc.IsFreeDelivery || false),
      items: (doc.items || []).map((i: any) => ({
        id: i.id || i.ItemID,
        docId: i.docId || i.DocID,
        description: i.description || i.Description,
        quantity: Number(i.quantity || i.Quantity || 0),
        unitPrice: Number(i.unitPrice || i.UnitPrice || 0),
        amount: Number(i.amount || i.Amount || 0),
      })),
    };
  } catch (error) {
    console.error("Failed to fetch document:", error);
    return null;
  }
}

export async function getDocumentByDocNumber(docNumber: string): Promise<InvoiceDocument | null> {
  try {
    const docs = await getDocuments();
    const match = docs.find((d) => d.docNumber === docNumber);
    if (!match) return null;
    return getDocument(match.id);
  } catch (error) {
    console.error("Failed to fetch document by docNumber:", error);
    return null;
  }
}

export async function getNextDocNumber(): Promise<string | null> {
  try {
    const result = await fetchGasApi<{ success: boolean; docNumber?: string }>("getNextDocNumber");
    if (!result || !result.success || !result.docNumber) {
      return null;
    }
    return result.docNumber;
  } catch (error) {
    console.error("Failed to fetch next document number:", error);
    return null;
  }
}

export async function createDocument(data: CreateDocumentPayload) {
  try {
    const result = await fetchGasApi<{ success: boolean; docId?: string; docNumber?: string; error?: string }>("createDocument", {
      method: "POST",
      body: data,
    });

    if (!result || !result.success) {
      return { success: false, error: result?.error || "Failed to create document" };
    }

    return { success: true, docId: result.docId, docNumber: result.docNumber };
  } catch (error: any) {
    console.error("Failed to create document:", error);
    return { success: false, error: error.message || error.toString() };
  }
}

export async function updateDocument(id: string, data: CreateDocumentPayload) {
  try {
    const payload = { ...data, id };
    const result = await fetchGasApi<{ success: boolean; docId?: string; docNumber?: string; error?: string }>("updateDocument", {
      method: "POST",
      body: payload,
    });

    if (!result || !result.success) {
      return { success: false, error: result?.error || "Failed to update document" };
    }

    return { success: true, docId: result.docId || id, docNumber: result.docNumber || data.docNumber };
  } catch (error: any) {
    console.error("Failed to update document:", error);
    return { success: false, error: error.message || error.toString() };
  }
}

export async function deleteDocument(id: string) {
  try {
    const result = await fetchGasApi<{ success: boolean; error?: string }>("deleteDocument", {
      method: "POST",
      body: { id },
    });

    if (!result || !result.success) {
      return { success: false, error: result?.error || "Failed to delete document" };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete document:", error);
    return { success: false, error: error.message || error.toString() };
  }
}

export async function recoverDocument(id: string) {
  try {
    const result = await fetchGasApi<{ success: boolean; error?: string }>("recoverDocument", {
      method: "POST",
      body: { id },
    });

    if (!result || !result.success) {
      return { success: false, error: result?.error || "Document recovery not supported or document not found" };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to recover document:", error);
    return { success: false, error: error.message || error.toString() };
  }
}

export type ItemSuggestion = {
  description: string;
  price: number;
};

export async function getItemSuggestions(): Promise<ItemSuggestion[]> {
  try {
    const result = await fetchGasApi<{ success: boolean; data: ItemSuggestion[] }>("getItemSuggestions");
    if (!result || !result.success || !Array.isArray(result.data)) {
      return [];
    }
    return result.data;
  } catch (error) {
    console.error("Failed to fetch item suggestions:", error);
    return [];
  }
}
