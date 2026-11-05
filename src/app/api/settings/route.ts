import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { salonUpdateInput } from "@/lib/validation";
import { updateSalon } from "@/services/salon-config";

export async function PATCH(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant("settings.write");
    const { settings, ...input } = await readJson(request, salonUpdateInput);
    return ok(await updateSalon(context, input, settings));
  });
}
