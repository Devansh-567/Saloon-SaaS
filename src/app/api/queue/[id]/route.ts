import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { queueUpdate } from "@/lib/validation";
import { updateQueueTicket } from "@/services/queue";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("queue.write");
    const { id } = await params;
    const input = await readJson(request, queueUpdate);
    return ok(await updateQueueTicket(context, id, input));
  });
}
