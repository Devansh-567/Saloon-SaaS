import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { paymentInput } from "@/lib/validation";
import { addPayment } from "@/services/billing";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("billing.write");
    const { id } = await params;
    return ok(await addPayment(context, id, await readJson(request, paymentInput)), 201);
  });
}
