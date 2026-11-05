import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { queueInput } from "@/lib/validation";
import { addToQueue } from "@/services/queue";

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant("queue.write");
    const input = await readJson(request, queueInput);
    return ok(await addToQueue(context, input), 201);
  });
}
