import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { advanceDecisionInput } from "@/lib/validation";
import { decideAdvance } from "@/services/hr";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("hr.write");
    const { id } = await params;
    return ok(await decideAdvance(context, id, await readJson(request, advanceDecisionInput)));
  });
}
