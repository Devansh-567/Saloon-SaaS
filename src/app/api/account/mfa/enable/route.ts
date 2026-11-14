import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { mfaEnableInput } from "@/lib/validation";
import { enableMfa } from "@/services/auth-service";

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant();
    const input = await readJson(request, mfaEnableInput);
    return ok(await enableMfa(context, input));
  });
}
