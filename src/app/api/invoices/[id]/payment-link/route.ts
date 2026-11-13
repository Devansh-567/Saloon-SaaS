// 2026 Devansh Singh
// Guru AI Technologies
import { NextRequest } from "next/server";
import { withApi, ok } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { createPaymentLink } from "@/services/online-payments";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("billing.write");
    const { id } = await params;
    return ok(await createPaymentLink(context, id));
  });
}
