# Copyright (c) 2026 Devansh Singh
# All Rights Reserved.
#
# This software and its source code are proprietary
# and confidential property of Guru AI Technologies.
#
# Unauthorized copying, modification, distribution,
# or use of this software, in whole or in part,
# is strictly prohibited without prior written
# permission from Guru AI Technologies.
import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { employeeProfileInput } from "@/lib/validation";
import { getEmployeePerformance, updateEmployeeProfile } from "@/services/hr";
import { zonedDateInput, zonedDayBounds, zonedStartOfDay } from "@/lib/timezone";

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("hr.write");
    const { id } = await params;
    return ok(await updateEmployeeProfile(context, id, await readJson(request, employeeProfileInput)));
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant();
    const { id } = await params;
    const today = zonedDateInput(new Date(), context.salon.timezone);
    const fromDate = request.nextUrl.searchParams.get("from") || shiftDate(today, -29);
    const toDate = request.nextUrl.searchParams.get("to") || today;
    const from = zonedStartOfDay(fromDate, context.salon.timezone);
    const to = zonedDayBounds(toDate, context.salon.timezone).to;
    return ok(await getEmployeePerformance(context, id, from, to));
  });
}
