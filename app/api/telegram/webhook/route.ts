import { NextRequest, NextResponse } from "next/server";
import {
  sendTelegramMessage,
  sendTelegramChatAction,
  answerCallbackQuery,
  sendTelegramDocumentBuffer,
} from "@/lib/telegram";
import { downloadTelegramFileAsBase64 } from "@/lib/telegramMedia";
import {
  getOrCreateActiveJob,
  updateJob,
  appendChatHistory,
  ConversationalJob,
} from "@/lib/jobStore";
import { processConversationWithLLM, generateLivelyAck } from "@/lib/privacyExtractor";
import { getNextDocNumber, createDocument, getDocumentByDocNumber } from "@/lib/api";
import { generateInvoicePdfBuffer } from "@/lib/pdfServer";

// Allow execution time up to 30s on Vercel
export const maxDuration = 30;

function isChatAllowed(chatId: number): boolean {
  const allowed = process.env.ALLOWED_CHAT_IDS;
  if (!allowed || allowed.trim() === "*" || allowed.trim() === "") return true;
  const list = allowed.split(",").map((id) => id.trim());
  return list.includes(String(chatId));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Handle Callback Queries (Inline Button Clicks)
    if (body.callback_query) {
      const cb = body.callback_query;
      const chatId = cb.message?.chat?.id;
      const data = cb.data || "";

      if (chatId && !isChatAllowed(chatId)) {
        await answerCallbackQuery(cb.id, "Access Denied");
        return NextResponse.json({ ok: true });
      }

      await answerCallbackQuery(cb.id);

      if (data.startsWith("confirm_invoice:")) {
        const jobId = data.replace("confirm_invoice:", "");
        // Process DB Save and PDF Generation asynchronously
        processConfirmationAsync(chatId, jobId, cb.message?.message_id);
      } else if (data.startsWith("cancel_invoice:")) {
        const jobId = data.replace("cancel_invoice:", "");
        await updateJob(jobId, { status: "ABANDONED" });
        await sendTelegramMessage(
          chatId,
          "Invoice creation cancelled. Send a message anytime to start a new invoice!"
        );
      }

      return NextResponse.json({ ok: true });
    }

    // 2. Handle Messages (Text, Photo, Voice)
    const message = body.message;
    if (!message || !message.chat) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;

    // Check Whitelist Access Control
    if (!isChatAllowed(chatId)) {
      await sendTelegramMessage(
        chatId,
        "Sorry, I'm not set up to help here. Please contact the team directly."
      );
      return NextResponse.json({ ok: true });
    }

    // Extract text / caption
    const textInput = message.text || message.caption || "";

    // Check for PDF Re-Download Request (e.g. /get 2607-005 or "resend invoice 2607-005")
    const getMatch = textInput.match(/(?:resend invoice|\/get)\s+([A-Za-z0-9-]+)/i);
    if (getMatch && getMatch[1]) {
      const targetDocNum = getMatch[1].trim();
      processPdfRedownloadAsync(chatId, targetDocNum);
      return NextResponse.json({ ok: true });
    }

    // Identify Media (Photo or Voice Note)
    let fileIdToDownload: string | null = null;
    if (message.photo && message.photo.length > 0) {
      // Pick highest resolution photo
      fileIdToDownload = message.photo[message.photo.length - 1].file_id;
    } else if (message.voice && message.voice.file_id) {
      fileIdToDownload = message.voice.file_id;
    }

    // Process Message Asynchronously after immediate 200 OK
    processIncomingMessageAsync(chatId, textInput, fileIdToDownload);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error in Telegram Webhook:", error);
    return NextResponse.json({ ok: true });
  }
}

/**
 * Async Message Processor
 */
async function processIncomingMessageAsync(
  chatId: number,
  textInput: string,
  fileId: string | null
) {
  try {
    console.log(`\n==================================================`);
    console.log(`📩 [STEP 1] INCOMING MESSAGE (Chat ID: ${chatId})`);
    console.log(`   Text / Caption: "${textInput || "(None)"}"`);
    console.log(`   Media File ID: ${fileId || "(None)"}`);

    // [STEP 1] Transport received
    await sendTelegramChatAction(chatId, "typing");
    await sendTelegramMessage(chatId, `📥 *[STEP 1] Message Received*\n• Text/Caption: "${textInput || "(None)"}"\n• Has Media: ${fileId ? "Yes" : "No"}`);

    // [STEP 2] Session Manager
    const job = await getOrCreateActiveJob(chatId);
    if (!job) {
      console.error("❌ Failed to load/create job session for Chat ID:", chatId);
      await sendTelegramMessage(chatId, "Sorry, something went wrong on my end 😅 Please resend your last message and I'll try again!");
      return;
    }
    console.log(`🗂️ [STEP 2] SESSION LOADED (Job ID: ${job.id})`);
    console.log(`   Current Customer:`, job.draft_customer?.name || "(None)");
    console.log(`   Current Items Count:`, job.draft_items?.length || 0);

    await sendTelegramMessage(chatId, `🗂️ *[STEP 2] Session Loaded*\n• Job ID: ${job.id}\n• Draft Customer: ${job.draft_customer?.name || "(None)"}\n• Draft Items: ${job.draft_items?.length || 0} item(s)\n• Chat History Entries: ${job.chat_history?.length || 0}`);

    // Fire Fast Parallel Status Acknowledgment Call (100% LLM Generated)
    const livelyAck = await generateLivelyAck(job, textInput, Boolean(fileId));
    if (livelyAck) {
      console.log(`💬 [FAST ACK]: "${livelyAck}"`);
      await sendTelegramMessage(chatId, `💬 *[Fast Ack]* ${livelyAck}`);

      // Update rolling anti-repetition buffer (capped at 5)
      const updatedAcks = [...(job.recent_acknowledgments || []), livelyAck].slice(-5);
      job.recent_acknowledgments = updatedAcks;
      await updateJob(job.id, { recent_acknowledgments: updatedAcks });
    }

    // Check Concurrency Lock (Deduplicate rapid concurrent Telegram webhooks)
    if (job.job_lock) {
      const lockTime = new Date(job.job_lock).getTime();
      if (Date.now() - lockTime < 5000) {
        console.log(`⚠️ [DEDUPLICATION] Skipping rapid duplicate webhook for job ${job.id}`);
        return;
      }
    }
    await updateJob(job.id, { job_lock: new Date().toISOString() });

    // [STEP 3] Media Download
    let newMedia = null;
    if (fileId) {
      console.log(`📎 [STEP 3] Downloading media file...`);
      await sendTelegramMessage(chatId, `📎 *[STEP 3] Downloading Media...*\n• File ID: ${fileId}`);
      newMedia = await downloadTelegramFileAsBase64(fileId);
      console.log(`✅ [STEP 3] Media downloaded. MIME: ${newMedia?.mimeType}, Size: ${newMedia?.base64Data?.length || 0} base64 chars`);
      await sendTelegramMessage(chatId, `✅ *[STEP 3] Media Downloaded*\n• MIME type: ${newMedia?.mimeType || "unknown"}\n• Base64 size: ${newMedia?.base64Data?.length || 0} chars`);
    } else {
      await sendTelegramMessage(chatId, `📎 *[STEP 3] No Media* — Text-only message.`);
    }

    // [STEP 4] Context Assembler & LLM Call
    console.log(`🧠 [STEP 4] Calling Gemini 3.5 Flash Lite Extractor...`);
    await sendTelegramMessage(chatId, `🧠 *[STEP 4] Sending to Gemini LLM...*\n• Input caption passed: "${textInput || "(None)"}"\n• Media attached: ${newMedia ? "Yes" : "No"}`);
    const llmResult = await processConversationWithLLM(job, textInput, newMedia);

    console.log(`✅ [STEP 4] EXTRACTED RESULT:`);
    console.log(`   Customer:`, llmResult.extractedCustomer);
    console.log(`   Items (${llmResult.extractedItems?.length || 0}):`, llmResult.extractedItems);
    console.log(`   Is Out of Scope:`, llmResult.isOutOfScope);

    const debugItems = (llmResult.extractedItems || [])
      .map((i) => {
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

    // [STEP 5] Append chat history
    let formattedText = textInput || (fileId ? "[Attachment Media]" : "");
    if (llmResult.extractedMediaSummary) {
      formattedText += ` [Extracted Media Context: ${llmResult.extractedMediaSummary}]`;
    }
    await appendChatHistory(job, "user", formattedText);
    await updateJob(job.id, { job_lock: null });
    await sendTelegramMessage(chatId, `📝 *[STEP 5] Chat History Updated*\n• Saved: "${formattedText.substring(0, 120)}..."`);

    // Scope guardrail
    if (llmResult.isOutOfScope) {
      const handoffText = llmResult.outOfScopeSummary || "I'm set up to help create new invoices only. For other requests, please contact our human team member!";
      await sendTelegramMessage(chatId, `⚠️ ${handoffText}`);
      await appendChatHistory(job, "assistant", handoffText);
      return;
    }

    // [STEP 6] State Updater
    if (llmResult.extractedCustomer) job.draft_customer = llmResult.extractedCustomer;
    if (llmResult.extractedItems && llmResult.extractedItems.length > 0) job.draft_items = llmResult.extractedItems;
    await updateJob(job.id, { draft_customer: job.draft_customer, draft_items: job.draft_items });
    console.log(`💾 [STEP 6] MERGED DRAFT STATE SAVED: Customer=${job.draft_customer?.name || "(None)"}, Items=${job.draft_items?.length || 0}`);
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

    console.log(`🖨️ [STEP 7] STATE DECISION: isComplete=${isComplete} (hasCustomerName=${hasCustomerName}, hasItems=${hasItems})`);

    let totalAmount = 0;
    const itemLines = items.map((it) => {
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

    if (!isComplete) {
      const missingParts = [];
      if (!hasCustomerName) missingParts.push("customer name");
      if (!hasItems) missingParts.push("line items");
      previewMessage += `\n\n📌 *Next Step:* Please provide ${missingParts.join(" and ")} to complete the draft!`;
    }

    const inlineKeyboard = {
      inline_keyboard: [[
        { text: "✅ Confirm & Create Invoice", callback_data: `confirm_invoice:${job.id}` },
        { text: "❌ Cancel", callback_data: `cancel_invoice:${job.id}` },
      ]],
    };

    await sendTelegramMessage(chatId, previewMessage, { reply_markup: inlineKeyboard });
    console.log(`==================================================\n`);
  } catch (error) {
    console.error("❌ FATAL EXCEPTION in processIncomingMessageAsync:", error);
    await sendTelegramMessage(
      chatId,
      "Sorry, something went wrong on my end 😅 Please resend your last message and I'll try again!"
    );
  }
}

/**
 * Async Confirmation Processor
 */
async function processConfirmationAsync(chatId: number, jobId: string, messageId?: number) {
  try {
    await sendTelegramChatAction(chatId, "upload_document");
    await sendTelegramMessage(chatId, "Creating your invoice & generating PDF... 📄");

    // 1. Fetch Job Session
    const { data, error } = await (await import("@/lib/supabaseClient")).supabase
      .from("conversational_invoice_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (error || !data) {
      await sendTelegramMessage(chatId, "Could not find active session details. Please try again.");
      return;
    }

    const job: ConversationalJob = data;
    const cust = job.draft_customer || { name: "Customer" };
    const items = job.draft_items || [];

    if (items.length === 0) {
      await sendTelegramMessage(chatId, "Invoice has no line items! Please add items first.");
      return;
    }

    // 2. Generate Doc Number & Create Document in Database via existing API
    const docNumber = await getNextDocNumber();
    if (!docNumber) {
      await sendTelegramMessage(
        chatId,
        "Could not generate a document number. Please try again."
      );
      return;
    }
    const todayStr = new Date().toISOString().split("T")[0];

    let totalAmount = 0;
    const formattedItems = items.map((it) => {
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
      console.error("Failed to save invoice to Supabase DB:", dbResult.error);
      await sendTelegramMessage(
        chatId,
        "Sorry, something went wrong saving to the database 😅 Please try again!"
      );
      return;
    }

    // 3. Generate PDF Buffer in Memory
    const pdfBuffer = await generateInvoicePdfBuffer({
      docNumber,
      issueDate: todayStr,
      customer: cust,
      items,
    });

    // 4. Send PDF attachment directly to Telegram
    const pdfFilename = `Invoice_${docNumber}.pdf`;
    await sendTelegramDocumentBuffer(
      chatId,
      pdfBuffer,
      pdfFilename,
      `Official Invoice #${docNumber}`
    );

    // 5. Send Warm Intern Follow-Up Message
    const summaryItemText = items
      .map((i) => `${i.quantity}x ${i.description}`)
      .join(", ");

    const internFollowup = `Done! 🎉 Here's the invoice for ${
      cust.name || "Customer"
    } (${summaryItemText} — RM ${totalAmount.toFixed(
      2
    )}). Let me know if anything needs changing!`;

    await sendTelegramMessage(chatId, internFollowup);

    // 6. Mark Session as INACTIVE (Completed)
    await updateJob(jobId, { status: "INACTIVE" });
  } catch (error) {
    console.error("Error in processConfirmationAsync:", error);
    await sendTelegramMessage(
      chatId,
      "Sorry, something went wrong on my end 😅 Please resend your last message and I'll try again!"
    );
  }
}

/**
 * Async PDF Re-download Processor
 */
async function processPdfRedownloadAsync(chatId: number, docNumber: string) {
  try {
    await sendTelegramChatAction(chatId, "upload_document");
    await sendTelegramMessage(chatId, `Fetching Invoice #${docNumber}... 📄`);

    const doc = await getDocumentByDocNumber(docNumber);
    if (!doc) {
      await sendTelegramMessage(
        chatId,
        `Could not find Invoice #${docNumber} in database.`
      );
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
      items: (doc.items || []).map((i) => ({
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
  } catch (error) {
    console.error("Error in processPdfRedownloadAsync:", error);
    await sendTelegramMessage(
      chatId,
      "Could not re-generate PDF. Please check the document number."
    );
  }
}
