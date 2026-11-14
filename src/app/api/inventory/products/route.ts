import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { productInput } from "@/lib/validation";
import { createProduct } from "@/services/inventory";

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant("inventory.write");
    return ok(await createProduct(context, await readJson(request, productInput)), 201);
  });
}
