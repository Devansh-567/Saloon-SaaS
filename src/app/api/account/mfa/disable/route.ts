import { NextRequest } from "next/server";
import { z } from "zod";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { disableMfa } from "@/services/auth-service";

const schema = z.object({ password: z.string().min(1).max(128), code: z.string().min(6).max(20) });

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant();
    await disableMfa(context, await readJson(request, schema));
    return ok({ success: true });
  });
}
