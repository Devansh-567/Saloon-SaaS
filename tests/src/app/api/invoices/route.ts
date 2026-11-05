import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { invoiceInput } from "@/lib/validation";
import { createInvoice } from "@/services/billing";

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant("billing.write");
    return ok(await createInvoice(context, await readJson(request, invoiceInput)), 201);
  });
}
