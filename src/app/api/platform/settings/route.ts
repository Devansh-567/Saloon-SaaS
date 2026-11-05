import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requirePlatformApi } from "@/lib/auth";
import { platformSettingsUpdate } from "@/lib/validation";
import { updatePlatformSettings } from "@/services/platform";

export async function PATCH(request: NextRequest) {
  return withApi(request, async () => {
    const viewer = await requirePlatformApi();
    return ok(await updatePlatformSettings(viewer.user.id, await readJson(request, platformSettingsUpdate)));
  });
}
