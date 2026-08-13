import { getCustomers } from "./api";
import { supabase } from "./supabaseClient";
import { ConversationalJob, DraftCustomer, DraftItem, getUserMemory } from "./jobStore";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

/**
 * Standardize Malaysian phone numbers to 01x-xxxxxxx format
 */
export function formatMalaysianPhone(rawPhone: string): string {
  if (!rawPhone) return "";
  // Strip non-digits
  let digits = rawPhone.replace(/\D/g, "");
  
  // Remove leading international prefix 60
  if (digits.startsWith("60")) {
    digits = digits.substring(2);
  }
  
  // Ensure leading zero
  if (!digits.startsWith("0")) {
    digits = "0" + digits;
  }

  // Format 01x-xxxxxxx or 011-xxxxxxxx
  if (digits.length >= 10 && digits.startsWith("01")) {
    if (digits.startsWith("011")) {
      return `${digits.substring(0, 3)}-${digits.substring(3)}`;
    }
    return `${digits.substring(0, 3)}-${digits.substring(3)}`;
  }

  return rawPhone.trim();
}

/**
 * Fetch Air-Gapped Catalog Descriptions from Database
 * (Excludes unit prices and financial totals from LLM prompt)
 */
async function getAirGappedCatalogDescriptions(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("line_items")
      .select("description");
    if (error || !data) return [];
    
    const set = new Set<string>();
    data.forEach((row) => {
      if (row.description) set.add(row.description.trim());
    });
    return Array.from(set);
  } catch (err) {
    console.error("Error fetching air-gapped catalog:", err);
    return [];
  }
}

/**
 * Fetch Air-Gapped Customer Names from Database
 * (Excludes phone, address, and billing info from LLM prompt)
 */
async function getAirGappedCustomerNames(): Promise<string[]> {
  try {
    const customers = await getCustomers();
    return customers.map((c) => c.name);
  } catch (err) {
    console.error("Error fetching air-gapped customer names:", err);
    return [];
  }
}

/**
 * Fast parallel LLM call (Gemini 3.5 Flash Lite) strictly for non-templated status acknowledgments
 */
export async function generateLivelyAck(
  job: ConversationalJob,
  currentTextInput?: string | null,
  hasMedia?: boolean
): Promise<string | null> {
  if (!GEMINI_API_KEY) {
    return null;
  }

  try {
    const recentAcks = (job.recent_acknowledgments || []).slice(-5);
    const antiRepetitionText = recentAcks.length > 0
      ? `Do NOT reuse any of these recent status openers or sentence structures:\n${recentAcks.map((a) => `- "${a}"`).join("\n")}`
      : "No recent openers yet.";

    const inputContext = currentTextInput
      ? `User input text: "${currentTextInput}"`
      : hasMedia
      ? "User attached a photo or voice note."
      : "User sent a conversational update.";

    const promptText = `
You are a fast, friendly office colleague helping log invoice details.
${inputContext}

${antiRepetitionText}

INSTRUCTIONS:
1. In under 10 words, react to what the user sent naturally and specifically (referencing the item, total amount, photo, or action).
2. Write like a quick text from a warm, helpful coworker before checking something.
3. Do NOT use complete-sentence templates like "Got it!" or "One sec!" verbatim.
4. Output ONLY the short acknowledgment text, with no quotes or JSON formatting.
`;

    const modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 30,
        },
      }),
    });

    if (!res.ok) return null;

    const resData = await res.json();
    const text = resData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || null;
  } catch (err) {
    console.error("Error in generateLivelyAck:", err);
    return null;
  }
}

/**
 * Calls Gemini API (Text/Vision/Audio) for pure entity extraction
 */
export async function processConversationWithLLM(
  job: ConversationalJob,
  currentTextInput?: string | null,
  newMedia?: { base64Data: string; mimeType: string } | null
): Promise<{
  extractedMediaSummary: string | null;
  extractedCustomer: DraftCustomer | null;
  extractedItems: DraftItem[];
  isOutOfScope: boolean;
  outOfScopeSummary?: string;
}> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is missing.");
  }

  // 1. Fetch Air-Gapped Catalog, Customer Lists, and Long-Term Memory
  const catalogList = await getAirGappedCatalogDescriptions();
  const customerNames = await getAirGappedCustomerNames();
  const userMemoryFacts = await getUserMemory(job.chat_id);

  // 2. Build Explicit State & Memory Payloads
  const currentStateSnapshot = JSON.stringify({
    customer: job.draft_customer || { name: null, phone: null, address: null },
    line_items: job.draft_items || [],
  });

  const memoryFactsText = userMemoryFacts.length > 0
    ? userMemoryFacts.map((f) => `- ${f}`).join("\n")
    : "- None recorded yet.";

  // 3. Build System Instruction for Entity Extraction
  const systemInstruction = `
You are a precise data extraction assistant for Perabot Megah team members creating invoices in Malaysia.

YOUR TASK:
1. Extract customer information and line item details from conversation history, text inputs, captions, photos, or voice notes.
2. Target JSON Structure:
   - customer: { name, phone, address }
   - line_items: array of { description, quantity, stated_total_price, stated_unit_price }
3. Scope Restriction: You ONLY assist with creating NEW invoices. If the user asks for financial reports, editing historical past invoices, refunds, or general questions, set "is_out_of_scope": true and provide a summary in "out_of_scope_summary".

CURRENT DRAFT STATE SNAPSHOT:
${currentStateSnapshot}

USER LONG-TERM MEMORY FACTS:
${memoryFactsText}

AIR-GAPPED CATALOG REFERENCE (Available DB Products):
${catalogList.map((c) => `- "${c}"`).join("\n")}

AVAILABLE REPEAT CUSTOMER NAMES:
${customerNames.map((n) => `- "${n}"`).join("\n")}

EXTRACTION RULES:
- Phone Numbers: Extract raw phone numbers.
- Item Extraction: Extract product mentions into line_items. Match against CATALOG REFERENCE flexibly.
- Price Extraction:
  - If a total price for a batch/item is mentioned (e.g. "RM75 FOR 20KG"), extract stated_total_price: 75, quantity: 20, stated_unit_price: null.
  - If a unit price is explicitly given (e.g. "RM3.75 per kg"), extract stated_unit_price: 3.75.
  - Do NOT perform division or mental math in prompt — extract raw values as given.
- Media Summary: If an image or voice note was provided, summarize key extracted facts in "extracted_media_summary".

Return ONLY valid JSON matching this schema:
{
  "extracted_media_summary": string|null,
  "customer": { "name": string|null, "phone": string|null, "address": string|null },
  "line_items": [
    {
      "description": string,
      "quantity": number|null,
      "stated_total_price": number|null,
      "stated_unit_price": number|null
    }
  ],
  "is_out_of_scope": boolean,
  "out_of_scope_summary": string|null
}
`;

  // 4. Format Truncated Conversation History (Sliding Window: Last 6 messages)
  const recentHistory = (job.chat_history || []).slice(-6);
  const historyText = recentHistory.length > 0
    ? recentHistory.map((h) => `[${h.timestamp}] ${h.sender.toUpperCase()}: ${h.text}`).join("\n")
    : "(No prior history)";

  const promptText = `
SYSTEM INSTRUCTION:
${systemInstruction}

NEW INCOMING MESSAGE / CAPTION FROM USER THIS TURN:
"${currentTextInput || "(Media attachment only / no text caption)"}"

RECENT CONVERSATION HISTORY (Last ${recentHistory.length} turns):
${historyText}

Please analyze the new incoming message/caption alongside the media attachment and current draft state, then return the JSON response.
`;

  // Construct Gemini Request Payload
  const contentsParts: any[] = [{ text: promptText }];
  if (newMedia && newMedia.base64Data) {
    contentsParts.push({
      inline_data: {
        mime_type: newMedia.mimeType,
        data: newMedia.base64Data,
      },
    });
  }

  const modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: contentsParts }],
      generationConfig: {
        response_mime_type: "application/json",
        temperature: 0.2,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Gemini API error:", errText);
    throw new Error(`Gemini API returned status ${res.status}`);
  }

  const resData = await res.json();
  const responseText =
    resData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

  console.log("🤖 [GEMINI EXTRACTOR RAW JSON OUTPUT]:\n", responseText);

  let parsedResult: any = {};
  try {
    parsedResult = JSON.parse(responseText);
  } catch (err) {
    console.error("Failed to parse Gemini JSON output:", responseText);
    parsedResult = {};
  }

  // 5. Backend Local Database Enrichment & Sanitation (Tier 2)
  const rawCustomer = parsedResult.customer || {};
  let finalCustomer: DraftCustomer = { ...job.draft_customer };

  if (rawCustomer.name) finalCustomer.name = rawCustomer.name;
  if (rawCustomer.address) finalCustomer.address = rawCustomer.address;
  if (rawCustomer.phone) {
    finalCustomer.phone = formatMalaysianPhone(rawCustomer.phone);
  }

  // Multi-Level Customer DB Resolution (Repeat Customers)
  if (finalCustomer.name || finalCustomer.phone) {
    const dbCustomers = await getCustomers();
    let matchedCust = null;

    if (finalCustomer.phone) {
      matchedCust = dbCustomers.find(
        (c) => c.phone && formatMalaysianPhone(c.phone) === finalCustomer.phone
      );
    }

    if (!matchedCust && finalCustomer.name) {
      const lowerName = finalCustomer.name.toLowerCase().trim();
      matchedCust = dbCustomers.find((c) =>
        c.name.toLowerCase().includes(lowerName)
      );
    }

    if (matchedCust) {
      finalCustomer.id = matchedCust.id;
      finalCustomer.name = matchedCust.name;
      if (!finalCustomer.phone && matchedCust.phone) {
        finalCustomer.phone = formatMalaysianPhone(matchedCust.phone);
      }
      if (!finalCustomer.address && matchedCust.address) {
        finalCustomer.address = matchedCust.address;
      }
      console.log(`👤 [CUSTOMER DB MATCH]: Matched repeat customer "${matchedCust.name}" (ID: ${matchedCust.id})`);
    }
  }

  // Process Line Items & Perform Arithmetic Computation in Fixed Code
  const rawItems: any[] = parsedResult.line_items || [];
  const finalItems: DraftItem[] = [];

  for (const item of rawItems) {
    const desc = item.description || "General Item";
    const qty = Number(item.quantity) || 1;
    let price: number | null = item.stated_unit_price !== null && item.stated_unit_price !== undefined
      ? Number(item.stated_unit_price)
      : null;

    // Fixed backend arithmetic: total_price / quantity
    if (price === null && item.stated_total_price !== null && item.stated_total_price !== undefined && qty > 0) {
      price = Number(item.stated_total_price) / qty;
      console.log(`🧮 [BACKEND MATH]: Computed unit_price RM ${price} from total RM ${item.stated_total_price} / qty ${qty}`);
    }

    // Fallback to historical DB unit price if omitted
    if (price === null) {
      const { data: dbItem } = await supabase
        .from("line_items")
        .select("unit_price")
        .eq("description", desc)
        .order("id", { ascending: false })
        .limit(1);

      if (dbItem && dbItem.length > 0 && dbItem[0].unit_price !== null) {
        price = Number(dbItem[0].unit_price);
        console.log(`📊 [HISTORICAL DB PRICE]: Used reference price RM ${price} for "${desc}"`);
      } else {
        price = 0;
      }
    }

    finalItems.push({
      description: desc,
      quantity: qty,
      unitPrice: price ?? 0,
      amount: qty * (price ?? 0),
    });
  }

  return {
    extractedMediaSummary: parsedResult.extracted_media_summary || null,
    extractedCustomer: finalCustomer,
    extractedItems: finalItems.length > 0 ? finalItems : job.draft_items,
    isOutOfScope: Boolean(parsedResult.is_out_of_scope),
    outOfScopeSummary: parsedResult.out_of_scope_summary || undefined,
  };
}
