import { NextRequest } from "next/server";
import { withApi, ok } from "@/lib/api";
import { requirePlatformApi } from "@/lib/auth";
import { deleteTemplate } from "@/services/platform";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const viewer = await requirePlatformApi();
    const { id } = await params;
    await deleteTemplate(viewer.user.id, id);
    return ok({ success: true });
  });
}
