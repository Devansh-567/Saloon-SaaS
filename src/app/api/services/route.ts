import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { serviceInput } from "@/lib/validation";
import { createService } from "@/services/salon-config";

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant("services.write");
    const input = await readJson(request, serviceInput);
    return ok(await createService(context, input), 201);
  });
}
