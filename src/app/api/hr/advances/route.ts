import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { forbidden } from "@/lib/errors";
import { advanceInput } from "@/lib/validation";
import { canSeeAllHr, createAdvance, listAdvances } from "@/services/hr";

export async function GET(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant();
    if (!canSeeAllHr(context) && !context.permissions.includes("hr.self")) throw forbidden("You cannot see advances");
    const status = request.nextUrl.searchParams.get("status") || undefined;
    const membershipId = request.nextUrl.searchParams.get("membershipId") || undefined;
    return ok(await listAdvances(context, { status, membershipId }));
  });
}

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant();
    if (!canSeeAllHr(context) && !context.permissions.includes("hr.self")) throw forbidden("You cannot request an advance");
    return ok(await createAdvance(context, await readJson(request, advanceInput)), 201);
  });
}
