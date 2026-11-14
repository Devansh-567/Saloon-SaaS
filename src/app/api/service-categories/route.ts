import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { categoryInput } from "@/lib/validation";
import { createCategory } from "@/services/salon-config";

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant("services.write");
    return ok(await createCategory(context, await readJson(request, categoryInput)), 201);
  });
}
