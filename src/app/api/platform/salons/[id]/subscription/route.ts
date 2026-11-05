import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requirePlatformApi } from "@/lib/auth";
import { subscriptionInput } from "@/lib/validation";
import { setSubscription } from "@/services/platform";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const viewer = await requirePlatformApi();
    const { id } = await params;
    return ok(await setSubscription(viewer.user.id, id, await readJson(request, subscriptionInput)));
  });
}
