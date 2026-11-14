import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { stockAdjustmentInput } from "@/lib/validation";
import { adjustStock } from "@/services/inventory";

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant("inventory.write");
    return ok(await adjustStock(context, await readJson(request, stockAdjustmentInput)));
  });
}
