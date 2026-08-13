import fs from "fs";
import path from "path";

// Read .env.local variables
const envPath = path.join(__dirname, "../.env.local");
if (!fs.existsSync(envPath)) {
  console.error("Missing .env.local file");
  process.exit(1);
}
const envContent = fs.readFileSync(envPath, "utf8");

const getEnvVar = (name: string) => {
  const match = envContent.match(new RegExp(`${name}\\s*=\\s*(.+)`));
  return match ? match[1].trim() : "";
};

// Set environment variables in process.env for Node test execution
process.env.NEXT_PUBLIC_SUPABASE_URL = getEnvVar("NEXT_PUBLIC_SUPABASE_URL").replace(/\/rest\/v1\/?$/, "");
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = getEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY");
process.env.TELEGRAM_BOT_TOKEN = getEnvVar("TELEGRAM_BOT_TOKEN");
process.env.GEMINI_API_KEY = getEnvVar("GEMINI_API_KEY");
process.env.ALLOWED_CHAT_IDS = getEnvVar("ALLOWED_CHAT_IDS");

import { getOrCreateActiveJob } from "../lib/jobStore";
import { processConversationWithLLM } from "../lib/privacyExtractor";

async function runLocalSimulation() {
  console.log("=".repeat(80));
  console.log("TELEGRAM BOT WORKFLOW LOCAL SIMULATION TEST");
  console.log("=".repeat(80));
  console.log("Bot Token Loaded:", process.env.TELEGRAM_BOT_TOKEN ? "YES" : "NO");
  console.log("Gemini Key Loaded:", process.env.GEMINI_API_KEY ? "YES" : "NO");
  console.log("Allowed Chat IDs:", process.env.ALLOWED_CHAT_IDS);
  console.log("");

  const testChatId = 7376369831; // User's Telegram Chat ID from .env.local

  console.log("Step 1: Creating/fetching active session job in Supabase...");
  const job = await getOrCreateActiveJob(testChatId);
  if (!job) {
    console.error("❌ Failed to create session job in database!");
    process.exit(1);
  }
  console.log("✓ Active Job Session created/retrieved:", job.id);

  console.log("\nStep 2: Simulating incoming order chat message from colleague...");
  const simulatedMessage = "Billing to Tan Ah Kow, 012-3456789, No 15 Jalan Merdeka. 3pcs 4 inci tilam RM78, free delivery";
  console.log(`> Chat Input: "${simulatedMessage}"`);

  job.chat_history.push({
    sender: "user",
    text: simulatedMessage,
    timestamp: new Date().toISOString(),
  });

  console.log("\nStep 3: Running Privacy-Sanitized LLM Extractor (Gemini)...");
  try {
    const result = await processConversationWithLLM(job, simulatedMessage);
    console.log("✓ LLM Extraction successful!");
    console.log("\n--- LLM Extracted Summary ---");
    console.log("Out of Scope Summary:", result.outOfScopeSummary || "N/A");
    console.log("Extracted Customer:", JSON.stringify(result.extractedCustomer, null, 2));
    console.log("Extracted Items:", JSON.stringify(result.extractedItems, null, 2));
    console.log("Is Out of Scope:", result.isOutOfScope);
    console.log("=".repeat(80));
    console.log("✅ LOCAL SIMULATION TEST COMPLETED SUCCESSFULLY!");
  } catch (error) {
    console.error("❌ LLM Extraction failed:", error);
  }
}

runLocalSimulation();
