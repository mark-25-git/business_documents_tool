import { CreateDocumentPayload, Customer, InvoiceDocument, DocumentType } from "./types";
import { supabase } from "./supabaseClient";

/**
 * Fetch all customers
 */
export async function getCustomers(): Promise<Customer[]> {
  try {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("name");
    
    if (error) {
      console.error("Failed to fetch customers from Supabase:", error);
      return [];
    }

    return (data || []).map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone || "",
      address: c.address || "",
      email: c.email || "",
      billingAddress: c.billing_address || "",
      billingPhone: c.billing_phone || "",
      billingEmail: c.billing_email || "",
      shippingName: c.shipping_name || "",
      shippingAddress: c.shipping_address || "",
      shippingPhone: c.shipping_phone || "",
      createdAt: c.created_at,
    }));
  } catch (error) {
    console.error("Failed to fetch customers:", error);
    return [];
  }
}

/**
 * Create a new customer
 */
export async function createCustomer(data: Omit<Customer, "id">) {
  try {
    const id = "CUST-" + new Date().getTime();
    const { error } = await supabase.from("customers").insert({
      id,
      name: data.name,
      phone: data.phone,
      address: data.address,
      email: data.email,
      billing_address: data.billingAddress || data.address || "",
      billing_phone: data.billingPhone || data.phone || "",
      billing_email: data.billingEmail || data.email || "",
      shipping_name: data.shippingName || data.name || "",
      shipping_address: data.shippingAddress || data.address || "",
      shipping_phone: data.shippingPhone || data.phone || "",
    });

    if (error) {
      console.error("Failed to create customer in Supabase:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id };
  } catch (error: any) {
    console.error("Failed to create customer:", error);
    return { success: false, error: error.message || error.toString() };
  }
}

/**
 * Update an existing customer
 */
export async function updateCustomer(data: Customer) {
  try {
    const { error } = await supabase
      .from("customers")
      .update({
        name: data.name,
        phone: data.phone,
        address: data.address,
        email: data.email,
        billing_address: data.billingAddress,
        billing_phone: data.billingPhone,
        billing_email: data.billingEmail,
        shipping_name: data.shippingName,
        shipping_address: data.shippingAddress,
        shipping_phone: data.shippingPhone,
      })
      .eq("id", data.id);

    if (error) {
      console.error("Failed to update customer in Supabase:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to update customer:", error);
    return { success: false, error: error.message || error.toString() };
  }
}

/**
 * Fetch all documents
 */
export async function getDocuments(): Promise<InvoiceDocument[]> {
  try {
    const { data, error } = await supabase
      .from("documents")
      .select("id, doc_number, type, date, customer_id, customer_name, total_amount, status")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch documents from Supabase:", error);
      return [];
    }

    return (data || []).map((d) => ({
      id: d.id,
      docNumber: d.doc_number,
      type: d.type as DocumentType,
      date: d.date,
      customerId: d.customer_id,
      customerName: d.customer_name,
      totalAmount: Number(d.total_amount),
      status: d.status,
    }));
  } catch (error) {
    console.error("Failed to fetch documents:", error);
    return [];
  }
}

/**
 * Fetch single document by ID
 */
export async function getDocument(id: string): Promise<InvoiceDocument | null> {
  try {
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", id)
      .single();

    if (docError || !doc) {
      console.error("Failed to fetch document header from Supabase:", docError);
      return null;
    }

    const { data: items, error: itemsError } = await supabase
      .from("line_items")
      .select("*")
      .eq("doc_id", id);

    if (itemsError) {
      console.error("Failed to fetch document items from Supabase:", itemsError);
      return null;
    }

    return {
      id: doc.id,
      docNumber: doc.doc_number,
      type: doc.type as DocumentType,
      date: doc.date,
      customerId: doc.customer_id,
      customerName: doc.customer_name,
      totalAmount: Number(doc.total_amount),
      status: doc.status,
      notes: doc.notes || "",
      billingAddress: doc.billing_address || "",
      billingPhone: doc.billing_phone || "",
      billingEmail: doc.billing_email || "",
      shippingName: doc.shipping_name || "",
      shippingAddress: doc.shipping_address || "",
      shippingPhone: doc.shipping_phone || "",
      items: (items || []).map((i) => ({
        id: i.id,
        docId: i.doc_id,
        description: i.description,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unit_price),
        amount: Number(i.amount),
      })),
    };
  } catch (error) {
    console.error("Failed to fetch document:", error);
    return null;
  }
}

/**
 * Get the next sequential document number
 */
export async function getNextDocNumber(): Promise<string | null> {
  try {
    const now = new Date();
    const year = now.getFullYear().toString().substr(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const prefix = `${year}${month}-`;

    const { data, error } = await supabase
      .from("documents")
      .select("doc_number")
      .like("doc_number", `${prefix}%`)
      .neq("status", "INACTIVE")
      .order("doc_number", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Failed to fetch next doc number from Supabase:", error);
      return null;
    }

    let counter = 1;
    if (data && data.length > 0) {
      const lastNum = data[0].doc_number;
      const parts = lastNum.split("-");
      if (parts.length === 2) {
        const parsed = parseInt(parts[1], 10);
        if (!isNaN(parsed)) {
          counter = parsed + 1;
        }
      }
    }

    const paddedCount = counter.toString().padStart(3, "0");
    return `${year}${month}-${paddedCount}`;
  } catch (error) {
    console.error("Failed to fetch next document number:", error);
    return null;
  }
}

/**
 * Create a new document
 */
export async function createDocument(data: CreateDocumentPayload) {
  try {
    let docNumber = data.docNumber;
    if (!docNumber) {
      const nextNum = await getNextDocNumber();
      if (!nextNum) throw new Error("Could not generate document number");
      docNumber = nextNum;
    } else {
      // Check for duplicate doc number
      const { data: existing, error: checkError } = await supabase
        .from("documents")
        .select("id")
        .eq("doc_number", docNumber)
        .limit(1);
      
      if (checkError) throw checkError;
      if (existing && existing.length > 0) {
        return { success: false, error: "Document number already exists: " + docNumber };
      }
    }

    const docId = "DOC-" + new Date().getTime();

    // Insert Document Header
    const { error: docError } = await supabase.from("documents").insert({
      id: docId,
      doc_number: docNumber,
      type: data.type,
      date: data.date,
      customer_id: data.customerId,
      customer_name: data.customerName,
      total_amount: data.totalAmount,
      status: data.status,
      notes: data.notes || "",
      billing_address: data.billingAddress,
      billing_phone: data.billingPhone,
      billing_email: data.billingEmail,
      shipping_name: data.shippingName,
      shipping_address: data.shippingAddress,
      shipping_phone: data.shippingPhone,
    });

    if (docError) throw docError;

    // Insert Line Items
    if (data.items && data.items.length > 0) {
      const itemsToInsert = data.items.map((item) => ({
        id: "ITEM-" + Math.random().toString(36).substr(2, 9),
        doc_id: docId,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        amount: item.amount,
      }));

      const { error: itemsError } = await supabase.from("line_items").insert(itemsToInsert);
      if (itemsError) throw itemsError;
    }

    // Master Record Sync
    if (data.syncToMaster && data.customerId && !data.customerId.startsWith("TEMP-")) {
      await updateCustomer({
        id: data.customerId,
        name: data.customerName,
        phone: data.billingPhone,
        address: data.billingAddress,
        email: data.billingEmail,
        billingAddress: data.billingAddress,
        billingPhone: data.billingPhone,
        billingEmail: data.billingEmail,
        shippingName: data.shippingName,
        shippingAddress: data.shippingAddress,
        shippingPhone: data.shippingPhone,
      });
    }

    return { success: true, docId, docNumber };
  } catch (error: any) {
    console.error("Failed to create document in Supabase:", error);
    return { success: false, error: error.message || error.toString() };
  }
}

/**
 * Update an existing document
 */
export async function updateDocument(id: string, data: CreateDocumentPayload) {
  try {
    // Update Document Header
    const { error: docError } = await supabase
      .from("documents")
      .update({
        doc_number: data.docNumber,
        type: data.type,
        date: data.date,
        customer_id: data.customerId,
        customer_name: data.customerName,
        total_amount: data.totalAmount,
        status: data.status,
        notes: data.notes || "",
        billing_address: data.billingAddress,
        billing_phone: data.billingPhone,
        billing_email: data.billingEmail,
        shipping_name: data.shippingName,
        shipping_address: data.shippingAddress,
        shipping_phone: data.shippingPhone,
      })
      .eq("id", id);

    if (docError) throw docError;

    // Delete existing line items
    const { error: deleteError } = await supabase
      .from("line_items")
      .delete()
      .eq("doc_id", id);

    if (deleteError) throw deleteError;

    // Insert new Line Items
    if (data.items && data.items.length > 0) {
      const itemsToInsert = data.items.map((item) => ({
        id: "ITEM-" + Math.random().toString(36).substr(2, 9),
        doc_id: id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        amount: item.amount,
      }));

      const { error: itemsError } = await supabase.from("line_items").insert(itemsToInsert);
      if (itemsError) throw itemsError;
    }

    // Master Record Sync
    if (data.syncToMaster && data.customerId) {
      await updateCustomer({
        id: data.customerId,
        name: data.customerName,
        phone: data.billingPhone,
        address: data.billingAddress,
        email: data.billingEmail,
        billingAddress: data.billingAddress,
        billingPhone: data.billingPhone,
        billingEmail: data.billingEmail,
        shippingName: data.shippingName,
        shippingAddress: data.shippingAddress,
        shippingPhone: data.shippingPhone,
      });
    }

    return { success: true, docId: id, docNumber: data.docNumber };
  } catch (error: any) {
    console.error("Failed to update document in Supabase:", error);
    return { success: false, error: error.message || error.toString() };
  }
}

/**
 * Delete a document by ID
 */
export async function deleteDocument(id: string) {
  try {
    const { data: doc, error: fetchError } = await supabase
      .from("documents")
      .select("doc_number")
      .eq("id", id)
      .single();
    
    if (fetchError || !doc) throw fetchError || new Error("Document not found");

    const originalDocNumber = doc.doc_number;
    
    // Find the highest document number currently in the database with the same prefix
    const dashIndex = originalDocNumber.lastIndexOf("-");
    const prefix = dashIndex !== -1 ? originalDocNumber.substring(0, dashIndex + 1) : "";
    
    const { data: highestDocs, error: highestError } = await supabase
      .from("documents")
      .select("doc_number")
      .like("doc_number", `${prefix}%`)
      .not("doc_number", "like", "%-DEL-%")
      .order("doc_number", { ascending: false })
      .limit(1);

    if (highestError) throw highestError;

    const isHighest = highestDocs && highestDocs.length > 0 && highestDocs[0].doc_number === originalDocNumber;
    let targetDocNumber = originalDocNumber;

    if (isHighest) {
      const now = new Date();
      const myTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
      const yyyy = myTime.getUTCFullYear();
      const mm = String(myTime.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(myTime.getUTCDate()).padStart(2, '0');
      const hh = String(myTime.getUTCHours()).padStart(2, '0');
      const min = String(myTime.getUTCMinutes()).padStart(2, '0');
      const ss = String(myTime.getUTCSeconds()).padStart(2, '0');
      const timestamp = `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
      targetDocNumber = `${originalDocNumber}-DEL-${timestamp}`;
    }

    const { error: updateError } = await supabase
      .from("documents")
      .update({ 
        status: "INACTIVE",
        doc_number: targetDocNumber
      })
      .eq("id", id);

    if (updateError) throw updateError;
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete document from Supabase:", error);
    return { success: false, error: error.message || error.toString() };
  }
}

/**
 * Recover a deleted/inactive document by ID
 */
export async function recoverDocument(id: string) {
  try {
    const { data: doc, error: fetchError } = await supabase
      .from("documents")
      .select("doc_number, type, status")
      .eq("id", id)
      .single();
    
    if (fetchError || !doc) throw fetchError || new Error("Document not found");

    const targetStatus = doc.type === 'INVOICE' ? 'PENDING' : 'DRAFT';
    const restoredDocNumber = doc.doc_number.replace(/-DEL-\d{8}-\d{6}/, '');

    const { data: existing, error: checkError } = await supabase
      .from("documents")
      .select("id")
      .eq("doc_number", restoredDocNumber)
      .neq("id", id)
      .limit(1);

    if (checkError) throw checkError;
    if (existing && existing.length > 0) {
      return { success: false, error: `Cannot recover: document number ${restoredDocNumber} already exists.` };
    }

    const { error: updateError } = await supabase
      .from("documents")
      .update({ 
        status: targetStatus,
        doc_number: restoredDocNumber
      })
      .eq("id", id);

    if (updateError) throw updateError;
    return { success: true };
  } catch (error: any) {
    console.error("Failed to recover document from Supabase:", error);
    return { success: false, error: error.message || error.toString() };
  }
}


export type ItemSuggestion = {
  description: string;
  price: number;
};

/**
 * Fetch all line items for autocomplete suggestions
 */
export async function getItemSuggestions(): Promise<ItemSuggestion[]> {
  try {
    const { data, error } = await supabase
      .from("line_items")
      .select("description, unit_price");

    if (error) {
      console.error("Failed to fetch item suggestions from Supabase:", error);
      return [];
    }

    const deliveryKeywords = ["delivery", "delivery fee", "free delivery", "shipping", "shipping fee"];
    const itemMap = new Map<string, number>();

    (data || []).forEach((row) => {
      if (!row.description) return;
      const desc = row.description.trim();
      if (desc === "") return;

      const lower = desc.toLowerCase();
      if (deliveryKeywords.some((keyword) => lower.includes(keyword))) return;

      if (!itemMap.has(desc)) {
        itemMap.set(desc, Number(row.unit_price || 0));
      }
    });

    return Array.from(itemMap.entries()).map(([description, price]) => ({
      description,
      price,
    }));
  } catch (error) {
    console.error("Failed to fetch item suggestions:", error);
    return [];
  }
}
