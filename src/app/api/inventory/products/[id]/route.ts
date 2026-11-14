import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { productInput } from "@/lib/validation";
import { deleteProduct, updateProduct } from "@/services/inventory";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("inventory.write");
    const { id } = await params;
    return ok(await updateProduct(context, id, await readJson(request, productInput.partial())));
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("inventory.write");
    const { id } = await params;
    return ok(await deleteProduct(context, id));
  });
}
