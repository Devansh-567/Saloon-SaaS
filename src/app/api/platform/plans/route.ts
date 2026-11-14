import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requirePlatformApi } from "@/lib/auth";
import { planInput } from "@/lib/validation";
import { createPlan } from "@/services/platform";

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    await requirePlatformApi();
    return ok(await createPlan(await readJson(request, planInput)), 201);
  });
}
