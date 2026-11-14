import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { customerInput } from "@/lib/validation";
import { updateCustomer } from "@/services/customers";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("customers.write");
    const { id } = await params;
    const input = await readJson(request, customerInput.partial());
    return ok(await updateCustomer(context, id, input));
  });
}
