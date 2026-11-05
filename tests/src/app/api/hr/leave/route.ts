import type { LeaveStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { forbidden } from "@/lib/errors";
import { leaveInput } from "@/lib/validation";
import { canSeeAllHr, createLeaveRequest, listLeaveRequests } from "@/services/hr";

export async function GET(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant();
    if (!canSeeAllHr(context) && !context.permissions.includes("hr.self")) throw forbidden("You cannot see leave requests");
    const status = request.nextUrl.searchParams.get("status") as LeaveStatus | null;
    const membershipId = request.nextUrl.searchParams.get("membershipId") || undefined;
    return ok(await listLeaveRequests(context, { status: status || undefined, membershipId }));
  });
}

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant();
    if (!canSeeAllHr(context) && !context.permissions.includes("hr.self")) throw forbidden("You cannot request leave");
    return ok(await createLeaveRequest(context, await readJson(request, leaveInput)), 201);
  });
}
