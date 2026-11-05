import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { followUpUpdate } from "@/lib/validation";
import { deleteFollowUp, updateFollowUp } from "@/services/customers";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; followUpId: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("customers.write");
    const { followUpId } = await params;
    return ok(await updateFollowUp(context, followUpId, await readJson(request, followUpUpdate)));
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; followUpId: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("customers.write");
    const { followUpId } = await params;
    return ok(await deleteFollowUp(context, followUpId));
  });
}
