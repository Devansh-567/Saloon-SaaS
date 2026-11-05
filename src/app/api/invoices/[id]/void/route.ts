import { NextRequest } from "next/server";
import { withApi, ok } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { voidInvoice } from "@/services/billing";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("billing.write");
    const { id } = await params;
    return ok(await voidInvoice(context, id));
  });
}
