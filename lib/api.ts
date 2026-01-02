import { CreateDocumentPayload, Customer, InvoiceDocument } from "./types";

// This will be set by the user in .env.local
// For client-side usage, we need to access it via window or pass it as a prop
// For now, we'll use a getter function that works in both server and client
const getGASApiUrl = () => {
  if (typeof window !== 'undefined') {
    // Client-side: use public env var
    return process.env.NEXT_PUBLIC_GAS_API_URL || '';
  }
  // Server-side
  return process.env.NEXT_PUBLIC_GAS_API_URL || '';
};

/**
 * Fetch all customers
 */
export async function getCustomers(): Promise<Customer[]> {
  const GAS_API_URL = getGASApiUrl();
  if (!GAS_API_URL) return [];

  try {
    const res = await fetch(`${GAS_API_URL}?action=getCustomers`, {
      cache: 'no-store'
    });
    const json = await res.json();
    return json.success ? json.data : [];
  } catch (error) {
    console.error("Failed to fetch customers:", error);
    return [];
  }
}

/**
 * Create a new customer
 */
export async function createCustomer(data: Omit<Customer, 'id'>) {
  const GAS_API_URL = getGASApiUrl();
  if (!GAS_API_URL) throw new Error("API URL not configured");

  try {
    const res = await fetch(`${GAS_API_URL}?action=createCustomer`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return json;
  } catch (error) {
    console.error("Failed to create customer:", error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Update an existing customer
 */
export async function updateCustomer(data: Customer) {
  const GAS_API_URL = getGASApiUrl();
  if (!GAS_API_URL) throw new Error("API URL not configured");

  try {
    const res = await fetch(`${GAS_API_URL}?action=updateCustomer`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return json;
  } catch (error) {
    console.error("Failed to update customer:", error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Fetch all documents
 */
export async function getDocuments(): Promise<InvoiceDocument[]> {
  const GAS_API_URL = getGASApiUrl();
  if (!GAS_API_URL) return [];

  try {
    const res = await fetch(`${GAS_API_URL}?action=getDocuments`, {
      cache: 'no-store'
    });
    const json = await res.json();
    return json.success ? json.data : [];
  } catch (error) {
    console.error("Failed to fetch documents:", error);
    return [];
  }
}

/**
 * Fetch single document by ID
 */
export async function getDocument(id: string): Promise<InvoiceDocument | null> {
  const GAS_API_URL = getGASApiUrl();
  if (!GAS_API_URL) return null;

  try {
    const res = await fetch(`${GAS_API_URL}?action=getDocument&id=${id}`, {
      cache: 'no-store'
    });
    const json = await res.json();
    return json.success ? json.data : null;
  } catch (error) {
    console.error("Failed to fetch document:", error);
    return null;
  }
}

/**
 * Create a new document
 */
export async function createDocument(data: CreateDocumentPayload) {
  const GAS_API_URL = getGASApiUrl();
  if (!GAS_API_URL) throw new Error("API URL not configured");

  try {
    const res = await fetch(`${GAS_API_URL}?action=createDocument`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return json;
  } catch (error) {
    console.error("Failed to create document:", error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Delete a document by ID
 */
export async function deleteDocument(id: string) {
  const GAS_API_URL = getGASApiUrl();
  if (!GAS_API_URL) throw new Error("API URL not configured");

  try {
    const res = await fetch(`${GAS_API_URL}?action=deleteDocument`, {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
    const json = await res.json();
    return json;
  } catch (error) {
    console.error("Failed to delete document:", error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Item suggestion with price
 */
export type ItemSuggestion = {
  description: string;
  price: number;
};

/**
 * Fetch all line items for autocomplete suggestions
 */
export async function getItemSuggestions(): Promise<ItemSuggestion[]> {
  const GAS_API_URL = getGASApiUrl();
  if (!GAS_API_URL) {
    console.warn("GAS_API_URL not configured");
    return [];
  }

  try {
    const url = `${GAS_API_URL}?action=getItemSuggestions`;
    console.log("Fetching item suggestions from:", url);
    const res = await fetch(url, {
      cache: 'no-store'
    });

    if (!res.ok) {
      console.error("Failed to fetch item suggestions - HTTP error:", res.status, res.statusText);
      return [];
    }

    const json = await res.json();
    console.log("Item suggestions response:", json);

    if (json.success && Array.isArray(json.data)) {
      console.log("Found", json.data.length, "item suggestions");
      // Handle both old format (string[]) and new format (ItemSuggestion[])
      return json.data.map((item: string | ItemSuggestion) => {
        if (typeof item === 'string') {
          // Legacy format - return with price 0
          return { description: item, price: 0 };
        }
        return item;
      });
    } else {
      console.warn("Unexpected response format:", json);
      return [];
    }
  } catch (error) {
    console.error("Failed to fetch item suggestions:", error);
    return [];
  }
}



