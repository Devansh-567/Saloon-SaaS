import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { branchInput } from "@/lib/validation";
import { createBranch } from "@/services/salon-config";

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant("settings.write");
    return ok(await createBranch(context, await readJson(request, branchInput)), 201);
  });
}
