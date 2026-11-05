import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { taxRateInput } from "@/lib/validation";
import { createTaxRate } from "@/services/salon-config";

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant("settings.write");
    return ok(await createTaxRate(context, await readJson(request, taxRateInput)), 201);
  });
}
