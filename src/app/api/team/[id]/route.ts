import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { membershipUpdate } from "@/lib/validation";
import { updateMembership } from "@/services/team";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("team.write");
    const { id } = await params;
    const input = await readJson(request, membershipUpdate);
    return ok(await updateMembership(context, id, input));
  });
}
