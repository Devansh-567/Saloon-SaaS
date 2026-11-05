import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { branchUpdateInput } from "@/lib/validation";
import { updateBranch } from "@/services/salon-config";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("settings.write");
    const { id } = await params;
    return ok(await updateBranch(context, id, await readJson(request, branchUpdateInput)));
  });
}
