import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { passwordChangeInput } from "@/lib/validation";
import { changePassword } from "@/services/auth-service";

export async function PATCH(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant();
    await changePassword(context, await readJson(request, passwordChangeInput));
    return ok({ success: true });
  });
}
