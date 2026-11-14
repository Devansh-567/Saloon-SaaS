import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requirePlatformApi } from "@/lib/auth";
import { platformSalonInput } from "@/lib/validation";
import { onboardSalon } from "@/services/platform";

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const viewer = await requirePlatformApi();
    return ok(await onboardSalon(viewer.user.id, await readJson(request, platformSalonInput)), 201);
  });
}
