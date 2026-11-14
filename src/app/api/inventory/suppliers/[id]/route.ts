import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { supplierInput } from "@/lib/validation";
import { deleteSupplier, updateSupplier } from "@/services/inventory";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("inventory.write");
    const { id } = await params;
    return ok(await updateSupplier(context, id, await readJson(request, supplierInput.partial())));
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("inventory.write");
    const { id } = await params;
    return ok(await deleteSupplier(context, id));
  });
}
