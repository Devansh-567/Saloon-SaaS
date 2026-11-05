import { NextRequest, NextResponse } from "next/server";
import { withApi } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { env } from "@/lib/env";
import { ensureInvoicePdf } from "@/services/invoice-pdf";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("billing.read");
    const { id } = await params;
    const file = await ensureInvoicePdf(id, context);
    return NextResponse.redirect(new URL(`/api/files/${file.id}?download=1`, env.APP_URL));
  });
}
