import { NextRequest } from "next/server";
import { withApi, ok } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { deletePurchase } from "@/services/inventory";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("inventory.write");
    const { id } = await params;
    return ok(await deletePurchase(context, id));
  });
}
