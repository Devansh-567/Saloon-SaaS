import { NextRequest } from "next/server";
import { z } from "zod";
import { withApi, ok, readJson } from "@/lib/api";
import { requirePlatformApi } from "@/lib/auth";
import { updateSalonStatus } from "@/services/platform";

const schema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const viewer = await requirePlatformApi();
    const { id } = await params;
    const input = await readJson(request, schema);
    return ok(await updateSalonStatus(viewer.user.id, id, input.status));
  });
}
