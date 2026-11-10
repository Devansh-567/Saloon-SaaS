import { NextRequest, NextResponse } from "next/server";
import { handleRazorpayEvent, verifyRazorpaySignature } from "@/services/online-payments";
import { logger } from "@/lib/logger";

// Called by Razorpay (not by a browser), so it is checked with Razorpay's signature instead of a login.
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifyRazorpaySignature(rawBody, request.headers.get("x-razorpay-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  try {
    await handleRazorpayEvent(JSON.parse(rawBody));
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("razorpay_webhook_failed", { error: error instanceof Error ? error.message : String(error) });
    // A 500 makes Razorpay try again later.
    return NextResponse.json({ error: "Could not record payment" }, { status: 500 });
  }
}
