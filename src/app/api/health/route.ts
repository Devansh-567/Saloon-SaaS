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
