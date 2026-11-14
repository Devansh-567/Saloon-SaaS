import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { followUpInput } from "@/lib/validation";
import { createFollowUp, listUpcomingFollowUps } from "@/services/customers";

export async function GET(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant("customers.read");
    return ok(await listUpcomingFollowUps(context));
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("customers.write");
    const { id } = await params;
    return ok(await createFollowUp(context, id, await readJson(request, followUpInput)), 201);
  });
}
