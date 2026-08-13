import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET() {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("conversational_invoice_jobs")
      .update({ status: "ABANDONED", updated_at: new Date().toISOString() })
      .eq("status", "ACTIVE")
      .lt("updated_at", twentyFourHoursAgo)
      .select("id");

    if (error) {
      console.error("Error auto-abandoning expired jobs:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const count = data ? data.length : 0;
    console.log(`Auto-abandon cron job completed. Marked ${count} jobs as ABANDONED.`);

    return NextResponse.json({ success: true, count });
  } catch (error: any) {
    console.error("Cron execution failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
