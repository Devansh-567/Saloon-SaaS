# Copyright (c) 2026 Devansh Singh
# All Rights Reserved.
#
# This software and its source code are proprietary
# and confidential property of Guru AI Technologies.
#
# Unauthorized copying, modification, distribution,
# or use of this software, in whole or in part,
# is strictly prohibited without prior written
# permission from Guru AI Technologies.
 import { NextRequest, NextResponse } from "next/server";
import { handleRazorpayEvent, verifyRazorpaySignature } from "@/services/online-payments";
import { logger } from "@/lib/logger";

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
    return NextResponse.json({ error: "Could not record payment" }, { status: 500 });
  }
}

