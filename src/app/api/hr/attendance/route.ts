import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { forbidden } from "@/lib/errors";
import { attendanceBulkInput, attendanceInput } from "@/lib/validation";
import { bulkMarkAttendance, canSeeAllHr, listAttendance, markAttendance } from "@/services/hr";

export async function GET(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant();
    if (!canSeeAllHr(context)) throw forbidden("You cannot see the staff attendance register");
    const date = request.nextUrl.searchParams.get("date") || new Date().toISOString().slice(0, 10);
    return ok(await listAttendance(context, date));
  });
}

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant("hr.write");
    return ok(await markAttendance(context, await readJson(request, attendanceInput)));
  });
}

export async function PUT(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant("hr.write");
    return ok(await bulkMarkAttendance(context, await readJson(request, attendanceBulkInput)));
  });
}
