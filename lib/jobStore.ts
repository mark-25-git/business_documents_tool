import { supabase } from "./supabaseClient";

export type ChatHistoryEntry = {
  sender: "user" | "assistant" | "system";
  text: string;
  timestamp: string;
};

export type DraftCustomer = {
  id?: string;
  name?: string;
  phone?: string;
  address?: string;
  email?: string;
  billingAddress?: string;
  billingPhone?: string;
  shippingAddress?: string;
};

export type DraftItem = {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount?: number;
  isCustomPrice?: boolean;
};

export type ConversationalJob = {
  id: string;
  chat_id: number;
  status: "ACTIVE" | "INACTIVE" | "ABANDONED";
  draft_customer: DraftCustomer | null;
  draft_items: DraftItem[];
  chat_history: ChatHistoryEntry[];
  recent_acknowledgments?: string[];
  job_lock?: string | null;
  created_at?: string;
  updated_at?: string;
};


/**
 * Get active conversational job for a Telegram chat_id or create a new one
 */
export async function getOrCreateActiveJob(chatId: number): Promise<ConversationalJob | null> {
  try {
    // 1. Check for active job
    const { data, error } = await supabase
      .from("conversational_invoice_jobs")
      .select("*")
      .eq("chat_id", chatId)
      .eq("status", "ACTIVE")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching conversational_invoice_jobs:", error);
    }

    if (data && data.length > 0) {
      const job = data[0];
      return {
        id: job.id,
        chat_id: job.chat_id,
        status: job.status,
        draft_customer: job.draft_customer || null,
        draft_items: job.draft_items || [],
        chat_history: job.chat_history || [],
        recent_acknowledgments: job.recent_acknowledgments || [],
        job_lock: job.job_lock,
        created_at: job.created_at,
        updated_at: job.updated_at,
      };
    }

    // 2. Create new job session
    const jobId = `JOB-${Date.now()}`;
    const newJob = {
      id: jobId,
      chat_id: chatId,
      status: "ACTIVE",
      draft_customer: null,
      draft_items: [],
      chat_history: [],
      recent_acknowledgments: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let { error: insertError } = await supabase
      .from("conversational_invoice_jobs")
      .insert(newJob);

    if (insertError && insertError.code === "PGRST204") {
      const { recent_acknowledgments, ...fallbackJob } = newJob;
      const { error: fallbackError } = await supabase
        .from("conversational_invoice_jobs")
        .insert(fallbackJob);
      if (fallbackError) {
        console.error("Failed to insert new conversational_invoice_job:", fallbackError);
        return null;
      }
    } else if (insertError) {
      console.error("Failed to insert new conversational_invoice_job:", insertError);
      return null;
    }

    return newJob as ConversationalJob;
  } catch (error) {
    console.error("Exception in getOrCreateActiveJob:", error);
    return null;
  }
}

/**
 * Update an existing job in Supabase
 */
export async function updateJob(
  jobId: string,
  updates: Partial<Omit<ConversationalJob, "id" | "chat_id">>
) {
  try {
    const payload: any = {
      updated_at: new Date().toISOString(),
    };
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.draft_customer !== undefined) payload.draft_customer = updates.draft_customer;
    if (updates.draft_items !== undefined) payload.draft_items = updates.draft_items;
    if (updates.chat_history !== undefined) payload.chat_history = updates.chat_history;
    if (updates.recent_acknowledgments !== undefined) payload.recent_acknowledgments = updates.recent_acknowledgments;
    if (updates.job_lock !== undefined) payload.job_lock = updates.job_lock;

    let { error } = await supabase
      .from("conversational_invoice_jobs")
      .update(payload)
      .eq("id", jobId);

    if (error && error.code === "PGRST204" && payload.recent_acknowledgments !== undefined) {
      delete payload.recent_acknowledgments;
      const { error: fallbackError } = await supabase
        .from("conversational_invoice_jobs")
        .update(payload)
        .eq("id", jobId);
      if (fallbackError) {
        console.error("Failed to update conversational_invoice_job:", fallbackError);
        return false;
      }
      return true;
    }

    if (error) {
      console.error("Failed to update conversational_invoice_job:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Exception in updateJob:", error);
    return false;
  }
}

/**
 * Append a chat message to history
 */
export async function appendChatHistory(
  job: ConversationalJob,
  sender: "user" | "assistant" | "system",
  text: string
) {
  const newEntry: ChatHistoryEntry = {
    sender,
    text,
    timestamp: new Date().toISOString(),
  };
  const updatedHistory = [...(job.chat_history || []), newEntry];
  job.chat_history = updatedHistory;
  await updateJob(job.id, { chat_history: updatedHistory });
}

/**
 * Fetch long-term cross-session memory facts for a user
 */
export async function getUserMemory(chatId: number): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("user_memory")
      .select("facts")
      .eq("chat_id", chatId)
      .single();

    if (error || !data || !Array.isArray(data.facts)) {
      return [];
    }
    return data.facts as string[];
  } catch (err) {
    console.error("Exception in getUserMemory:", err);
    return [];
  }
}

/**
 * Update long-term cross-session memory facts for a user
 */
export async function updateUserMemory(chatId: number, facts: string[]): Promise<boolean> {
  try {
    const payload = {
      chat_id: chatId,
      facts,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("user_memory")
      .upsert(payload, { onConflict: "chat_id" });

    if (error) {
      console.error("Failed to update user_memory:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Exception in updateUserMemory:", err);
    return false;
  }
}

