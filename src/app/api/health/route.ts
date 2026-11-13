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
 import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureStorage } from "@/lib/storage";

export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    await ensureStorage();
    return NextResponse.json({
      status: "ok",
      database: "ok",
      storage: "ok",
      latencyMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}

