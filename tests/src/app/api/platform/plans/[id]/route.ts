import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requirePlatformApi } from "@/lib/auth";
import { planInput } from "@/lib/validation";
import { updatePlan } from "@/services/platform";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const viewer = await requirePlatformApi();
    const { id } = await params;
    return ok(await updatePlan(viewer.user.id, id, await readJson(request, planInput.partial())));
  });
}
