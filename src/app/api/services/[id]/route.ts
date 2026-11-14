import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { serviceUpdate } from "@/lib/validation";
import { updateService } from "@/services/salon-config";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("services.write");
    const { id } = await params;
    const input = await readJson(request, serviceUpdate);
    return ok(await updateService(context, id, input));
  });
}
