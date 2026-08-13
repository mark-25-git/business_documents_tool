/**
 * Telegram Bot API Helper Library
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * Send a text message to a Telegram chat
 */
export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  options: {
    reply_markup?: any;
    parse_mode?: "Markdown" | "HTML";
  } = {}
) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN is not configured");
    return null;
  }

  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: options.parse_mode || "Markdown",
        reply_markup: options.reply_markup,
      }),
    });
    return await res.json();
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
    return null;
  }
}

/**
 * Send chat action (e.g. typing, upload_document)
 */
export async function sendTelegramChatAction(
  chatId: number | string,
  action: "typing" | "upload_document" | "find_location" = "typing"
) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`${TELEGRAM_API_BASE}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch (err) {
    console.error("Failed to send chat action:", err);
  }
}

/**
 * Answer callback query (inline button clicks)
 */
export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`${TELEGRAM_API_BASE}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  } catch (err) {
    console.error("Failed to answer callback query:", err);
  }
}

/**
 * Send PDF Document attachment from Buffer directly to Telegram
 */
export async function sendTelegramDocumentBuffer(
  chatId: number | string,
  pdfBuffer: Buffer,
  filename: string,
  caption?: string
) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN is not configured");
    return null;
  }

  try {
    const formData = new FormData();
    formData.append("chat_id", String(chatId));
    if (caption) formData.append("caption", caption);

    const blob = new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" });
    formData.append("document", blob, filename);

    const res = await fetch(`${TELEGRAM_API_BASE}/sendDocument`, {
      method: "POST",
      body: formData,
    });
    return await res.json();
  } catch (error) {
    console.error("Failed to send Telegram document:", error);
    return null;
  }
}

/**
 * Get File details (path) for photos / audio voice notes
 */
export async function getTelegramFile(fileId: string): Promise<{ file_path?: string } | null> {
  if (!TELEGRAM_BOT_TOKEN) return null;
  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/getFile?file_id=${fileId}`);
    const data = await res.json();
    if (data.ok && data.result) {
      return data.result;
    }
    return null;
  } catch (err) {
    console.error("Failed to get Telegram file info:", err);
    return null;
  }
}

/**
 * Get direct download URL for a file_path
 */
export function getTelegramFileDownloadUrl(filePath: string): string {
  return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
}
