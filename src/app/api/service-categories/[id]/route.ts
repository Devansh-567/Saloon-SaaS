import { NextRequest } from "next/server";
import { withApi, ok } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { deleteCategory } from "@/services/salon-config";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("services.write");
    const { id } = await params;
    await deleteCategory(context, id);
    return ok({ success: true });
  });
}
