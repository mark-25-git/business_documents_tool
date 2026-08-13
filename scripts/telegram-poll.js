/**
 * Local Telegram Long Polling Bridge
 * 
 * Polls Telegram for new messages and forwards them to your local Next.js server.
 * Run this alongside `npm run dev`. No tunnel needed.
 * 
 * Usage: node scripts/telegram-poll.js
 */

const TOKEN = "8865707236:AAHiCwk-TfQayIZYha3uima11EjrRC_Vrso";
const LOCAL_WEBHOOK = "http://localhost:3000/api/telegram/webhook";
const POLL_INTERVAL_MS = 1000;

let offset = 0;

async function deleteWebhook() {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/deleteWebhook`);
  const data = await res.json();
  console.log("[POLL] Webhook cleared:", data.description);
}

async function getUpdates() {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TOKEN}/getUpdates?offset=${offset}&timeout=10`
    );
    const data = await res.json();
    if (!data.ok || !data.result.length) return;

    for (const update of data.result) {
      offset = update.update_id + 1;

      console.log(`[POLL] Update #${update.update_id} → forwarding to local server...`);

      try {
        const fwdRes = await fetch(LOCAL_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(update),
        });
        console.log(`[POLL] Local server responded: ${fwdRes.status}`);
      } catch (err) {
        console.error("[POLL] Failed to forward to local server:", err.message);
      }
    }
  } catch (err) {
    console.error("[POLL] getUpdates error:", err.message);
  }
}

async function start() {
  console.log("[POLL] Clearing webhook so Telegram sends to polling...");
  await deleteWebhook();
  console.log(`[POLL] Polling started → forwarding to ${LOCAL_WEBHOOK}`);
  console.log("[POLL] Send a message on Telegram now.\n");

  setInterval(getUpdates, POLL_INTERVAL_MS);
}

start();
