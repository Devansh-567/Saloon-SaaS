import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { purchaseInput } from "@/lib/validation";
import { createPurchase } from "@/services/inventory";

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant("inventory.write");
    return ok(await createPurchase(context, await readJson(request, purchaseInput)), 201);
  });
}
