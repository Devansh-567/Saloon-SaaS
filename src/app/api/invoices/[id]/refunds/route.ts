import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { refundInput } from "@/lib/validation";
import { refundInvoice } from "@/services/billing";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("billing.refund");
    const { id } = await params;
    return ok(await refundInvoice(context, id, await readJson(request, refundInput)), 201);
  });
}
