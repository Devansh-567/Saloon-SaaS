import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requirePlatformApi } from "@/lib/auth";
import { templateInput } from "@/lib/validation";
import { upsertTemplate } from "@/services/platform";

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const viewer = await requirePlatformApi();
    return ok(await upsertTemplate(viewer.user.id, await readJson(request, templateInput)), 201);
  });
}
