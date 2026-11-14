import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { taxRateInput } from "@/lib/validation";
import { updateTaxRate } from "@/services/salon-config";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("settings.write");
    const { id } = await params;
    return ok(await updateTaxRate(context, id, await readJson(request, taxRateInput.partial())));
  });
}
