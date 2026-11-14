import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { leaveDecisionInput } from "@/lib/validation";
import { decideLeaveRequest } from "@/services/hr";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant();
    const { id } = await params;
    return ok(await decideLeaveRequest(context, id, await readJson(request, leaveDecisionInput)));
  });
}
