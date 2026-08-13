import fs from "fs";
import path from "path";

// 1. MUST LOAD ENV VARIABLES BEFORE ANY IMPORTS!
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  const getEnvVar = (name: string) => {
    const match = envContent.match(new RegExp(`${name}\\s*=\\s*(.+)`));
    return match ? match[1].trim() : "";
  };
  process.env.NEXT_PUBLIC_SUPABASE_URL = getEnvVar("NEXT_PUBLIC_SUPABASE_URL").replace(/\/rest\/v1\/?$/, "");
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = getEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.env.TELEGRAM_BOT_TOKEN = getEnvVar("TELEGRAM_BOT_TOKEN");
  process.env.GEMINI_API_KEY = getEnvVar("GEMINI_API_KEY");
  process.env.GEMINI_MODEL = getEnvVar("GEMINI_MODEL") || "gemini-3.5-flash-lite";
  process.env.ALLOWED_CHAT_IDS = getEnvVar("ALLOWED_CHAT_IDS");
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TELEGRAM_BOT_TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN in .env.local");
  process.exit(1);
}

// 2. NOW DYNAMICALLY IMPORT MODULES AFTER ENV IS READY!
const {
  sendTelegramMessage,
  sendTelegramChatAction,
  answerCallbackQuery,
  sendTelegramDocumentBuffer,
} = require("../lib/telegram");
const { downloadTelegramFileAsBase64 } = require("../lib/telegramMedia");
const {
  getOrCreateActiveJob,
  updateJob,
  appendChatHistory,
} = require("../lib/jobStore");
const { processConversationWithLLM, generateLivelyAck } = require("../lib/privacyExtractor");
const { getNextDocNumber, createDocument, getDocumentByDocNumber } = require("../lib/api");
const { generateInvoicePdfBuffer } = require("../lib/pdfServer");

function isChatAllowed(chatId: number): boolean {
  const allowed = process.env.ALLOWED_CHAT_IDS;
  if (!allowed || allowed.trim() === "*" || allowed.trim() === "") return true;
  const list = allowed.split(",").map((id) => id.trim());
  return list.includes(String(chatId));
}

let offset = 0;

async function pollUpdates() {
  console.log("=" .repeat(80));
  console.log("🚀 TELEGRAM LOCAL LONG-POLLING BOT IS LIVE!");
  console.log("Send a message to your bot in Telegram now.");
  console.log("=" .repeat(80));

  while (true) {
    try {
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}&timeout=20`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.ok && data.result) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          handleUpdateAsync(update);
        }
      }
    } catch (err) {
      console.error("Polling error:", err);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

async function handleUpdateAsync(update: any) {
  try {
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message?.chat?.id;
      const data = cb.data || "";

      if (chatId && !isChatAllowed(chatId)) {
        await answerCallbackQuery(cb.id, "Access Denied");
        return;
      }
      await answerCallbackQuery(cb.id);

      if (data.startsWith("confirm_invoice:")) {
        const jobId = data.replace("confirm_invoice:", "");
        await processConfirmation(chatId, jobId);
      } else if (data.startsWith("cancel_invoice:")) {
        const jobId = data.replace("cancel_invoice:", "");
        await updateJob(jobId, { status: "ABANDONED" });
        await sendTelegramMessage(
          chatId,
          "Invoice creation cancelled. Send a message anytime to start a new invoice!"
        );
      }
      return;
    }

    const message = update.message;
    if (!message || !message.chat) return;

    const chatId = message.chat.id;
    console.log(`\n📩 Incoming Message from Chat ID ${chatId}:`, message.text || "[Media]");

    if (!isChatAllowed(chatId)) {
      console.log(`🚫 Access denied for Chat ID ${chatId}`);
      await sendTelegramMessage(
        chatId,
        "Sorry, I'm not set up to help here. Please contact the team directly."
      );
      return;
    }

    const textInput = message.text || message.caption || "";

    const getMatch = textInput.match(/(?:resend invoice|\/get)\s+([A-Za-z0-9-]+)/i);
    if (getMatch && getMatch[1]) {
      await processPdfRedownload(chatId, getMatch[1].trim());
      return;
    }

    let fileIdToDownload: string | null = null;
    if (message.photo && message.photo.length > 0) {
      fileIdToDownload = message.photo[message.photo.length - 1].file_id;
    } else if (message.voice && message.voice.file_id) {
      fileIdToDownload = message.voice.file_id;
    }

    await processIncomingMessage(chatId, textInput, fileIdToDownload);
  } catch (err) {
    console.error("Error handling update:", err);
  }
}

async function processIncomingMessage(
  chatId: number,
  textInput: string,
  fileId: string | null
) {
  try {
    // [STEP 1] Transport received
    await sendTelegramChatAction(chatId, "typing");
    await sendTelegramMessage(chatId, `📥 *[STEP 1] Message Received*\n• Text/Caption: "${textInput || "(None)"}"\n• Has Media: ${fileId ? "Yes" : "No"}`);

    // [STEP 2] Session Loaded
    const job = await getOrCreateActiveJob(chatId);
    if (!job) return;
    await sendTelegramMessage(chatId, `🗂️ *[STEP 2] Session Loaded*\n• Job ID: ${job.id}\n• Draft Customer: ${job.draft_customer?.name || "(None)"}\n• Draft Items: ${job.draft_items?.length || 0} item(s)\n• Chat History Entries: ${job.chat_history?.length || 0}`);

    // Fire Fast Parallel Status Acknowledgment Call
    const livelyAck = await generateLivelyAck(job, textInput, Boolean(fileId));
    if (livelyAck) {
      await sendTelegramMessage(chatId, `💬 *[Fast Ack]* ${livelyAck}`);
      const updatedAcks = [...(job.recent_acknowledgments || []), livelyAck].slice(-5);
      job.recent_acknowledgments = updatedAcks;
      await updateJob(job.id, { recent_acknowledgments: updatedAcks });
    }

    // [STEP 3] Media Download
    let newMedia = null;
    if (fileId) {
      await sendTelegramMessage(chatId, `📎 *[STEP 3] Downloading Media...*\n• File ID: ${fileId}`);
      newMedia = await downloadTelegramFileAsBase64(fileId);
      await sendTelegramMessage(chatId, `✅ *[STEP 3] Media Downloaded*\n• MIME type: ${newMedia?.mimeType || "unknown"}\n• Base64 size: ${newMedia?.base64Data?.length || 0} chars`);
    } else {
      await sendTelegramMessage(chatId, `📎 *[STEP 3] No Media* — Text-only message.`);
    }

    // [STEP 4] LLM Call
    await sendTelegramMessage(chatId, `🧠 *[STEP 4] Sending to Gemini LLM...*\n• Input caption passed: "${textInput || "(None)"}"\n• Media attached: ${newMedia ? "Yes" : "No"}`);
    const llmResult = await processConversationWithLLM(job, textInput, newMedia);

    const debugItems = (llmResult.extractedItems || [])
      .map((i: any) => {
        const uP = Number(i.unitPrice) || 0;
        return `  - ${i.quantity || 1}x ${i.description} @ RM ${uP.toFixed(2)}`;
      })
      .join("\n");
    await sendTelegramMessage(chatId,
      `✅ *[STEP 4] LLM Response Received*\n` +
      `• Media Summary: "${llmResult.extractedMediaSummary || "(None)"}"\n` +
      `• Is Out of Scope: ${llmResult.isOutOfScope}\n` +
      `• Extracted Customer: ${llmResult.extractedCustomer?.name || "(None)"}\n` +
      `• Extracted Items (${llmResult.extractedItems?.length || 0}):\n${debugItems || "  (None)"}`
    );

    // [STEP 5] Append Chat History
    let formattedText = textInput || (fileId ? "[Attachment Media]" : "");
    if (llmResult.extractedMediaSummary) {
      formattedText += ` [Extracted Media Context: ${llmResult.extractedMediaSummary}]`;
    }
    await appendChatHistory(job, "user", formattedText);
    await sendTelegramMessage(chatId, `📝 *[STEP 5] Chat History Updated*\n• Saved: "${formattedText.substring(0, 120)}..."`);

    if (llmResult.isOutOfScope) {
      const handoffText =
        llmResult.outOfScopeSummary ||
        "I'm set up to help create new invoices only. For other requests, please contact our human team member!";
      await sendTelegramMessage(chatId, `⚠️ ${handoffText}`);
      await appendChatHistory(job, "assistant", handoffText);
      return;
    }

    // [STEP 6] State Saved
    if (llmResult.extractedCustomer) {
      job.draft_customer = llmResult.extractedCustomer;
    }
    if (llmResult.extractedItems && llmResult.extractedItems.length > 0) {
      job.draft_items = llmResult.extractedItems;
    }

    await updateJob(job.id, {
      draft_customer: job.draft_customer,
      draft_items: job.draft_items,
    });
    await sendTelegramMessage(chatId,
      `💾 *[STEP 6] State Saved to DB*\n` +
      `• Customer: ${job.draft_customer?.name || "(None)"}\n` +
      `• Items count: ${job.draft_items?.length || 0}`
    );

    // [STEP 7] Pure-Code State Decision & Render Preview Card
    await sendTelegramMessage(chatId, `🖨️ *[STEP 7] Building Preview Card...*`);
    const cust = job.draft_customer || {};
    const items = job.draft_items || [];
    const hasCustomerName = Boolean(cust.name && cust.name.trim().length > 0);
    const hasItems = items.length > 0;
    const isComplete = hasCustomerName && hasItems;

    let totalAmount = 0;
    const itemLines = items.map((it: any) => {
      const qty = Number(it.quantity) || 1;
      const uPrice = Number(it.unitPrice) || 0;
      const lineAmt = qty * uPrice;
      totalAmount += lineAmt;
      return `• ${qty}x ${it.description} @ RM ${uPrice.toFixed(2)} = *RM ${lineAmt.toFixed(2)}*`;
    });

    let previewMessage = `
📋 *Invoice Draft Summary*

👤 *Customer:* ${cust.name || "_(Pending)_"}
📞 *Phone:* ${cust.phone || "_(Pending)_"}
📍 *Address:* ${cust.address || "_(Pending)_"}

📦 *Line Items:*
${itemLines.length > 0 ? itemLines.join("\n") : "_(No items added yet)_"}

💰 *Total Amount:* *RM ${totalAmount.toFixed(2)}*
    `.trim();

    if (llmResult.needsClarification && llmResult.clarificationQuestion) {
      previewMessage += `\n\n${llmResult.clarificationQuestion}`;
    }

    const inlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: "✅ Confirm & Create Invoice",
            callback_data: `confirm_invoice:${job.id}`,
          },
          { text: "❌ Cancel", callback_data: `cancel_invoice:${job.id}` },
        ],
      ],
    };

    await sendTelegramMessage(chatId, previewMessage, {
      reply_markup: inlineKeyboard,
    });
  } catch (error) {
    console.error("Error processing incoming message:", error);
    await sendTelegramMessage(
      chatId,
      "Sorry, something went wrong on my end 😅 Please resend your last message!"
    );
  }
}

async function processConfirmation(chatId: number, jobId: string) {
  try {
    await sendTelegramChatAction(chatId, "upload_document");
    await sendTelegramMessage(chatId, "Creating your invoice & generating PDF... 📄");

    const { data: job } = await (await import("../lib/supabaseClient")).supabase
      .from("conversational_invoice_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (!job) return;

    const cust = job.draft_customer || { name: "Customer" };
    const items = job.draft_items || [];

    const docNumber = await getNextDocNumber();
    if (!docNumber) return;

    const todayStr = new Date().toISOString().split("T")[0];

    let totalAmount = 0;
    const formattedItems = items.map((it: any) => {
      const amt = (it.quantity || 1) * (it.unitPrice || 0);
      totalAmount += amt;
      return {
        description: it.description,
        quantity: it.quantity || 1,
        unitPrice: it.unitPrice || 0,
        amount: amt,
      };
    });

    const createPayload = {
      type: "INVOICE" as const,
      date: todayStr,
      customerId: cust.id || "",
      customerName: cust.name || "Customer",
      totalAmount,
      status: "ISSUED",
      billingAddress: cust.address || "",
      billingPhone: cust.phone || "",
      billingEmail: cust.email || "",
      shippingName: cust.name || "",
      shippingAddress: cust.address || "",
      shippingPhone: cust.phone || "",
      items: formattedItems,
    };

    const dbResult = await createDocument(createPayload);
    if (!dbResult.success) {
      await sendTelegramMessage(chatId, "Failed to save invoice to Supabase DB!");
      return;
    }

    const pdfBuffer = await generateInvoicePdfBuffer({
      docNumber,
      issueDate: todayStr,
      customer: cust,
      items,
    });

    await sendTelegramDocumentBuffer(
      chatId,
      pdfBuffer,
      `Invoice_${docNumber}.pdf`,
      `Official Invoice #${docNumber}`
    );

    const summaryItemText = items
      .map((i: any) => `${i.quantity}x ${i.description}`)
      .join(", ");

    await sendTelegramMessage(
      chatId,
      `Done! 🎉 Here's the invoice for ${
        cust.name || "Customer"
      } (${summaryItemText} — RM ${totalAmount.toFixed(
        2
      )}). Let me know if anything needs changing!`
    );

    await updateJob(jobId, { status: "INACTIVE" });
  } catch (err) {
    console.error("Error confirming invoice:", err);
  }
}

async function processPdfRedownload(chatId: number, docNumber: string) {
  try {
    await sendTelegramChatAction(chatId, "upload_document");
    await sendTelegramMessage(chatId, `Fetching Invoice #${docNumber}... 📄`);

    const doc = await getDocumentByDocNumber(docNumber);
    if (!doc) {
      await sendTelegramMessage(chatId, `Could not find Invoice #${docNumber}.`);
      return;
    }

    const pdfBuffer = await generateInvoicePdfBuffer({
      docNumber: doc.docNumber,
      issueDate: doc.date,
      customer: {
        name: doc.customerName,
        phone: doc.billingPhone,
        address: doc.billingAddress,
      },
      items: (doc.items || []).map((i: any) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        amount: i.amount,
      })),
    });

    await sendTelegramDocumentBuffer(
      chatId,
      pdfBuffer,
      `Invoice_${doc.docNumber}.pdf`,
      `Invoice #${doc.docNumber}`
    );
  } catch (err) {
    console.error("Error re-downloading PDF:", err);
  }
}

pollUpdates();
