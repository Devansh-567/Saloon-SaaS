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
import { appointmentUpdate } from "@/lib/validation";
import { updateAppointment } from "@/services/appointments";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("appointments.write");
    const { id } = await params;
    const input = await readJson(request, appointmentUpdate);
    return ok(await updateAppointment(context, id, input));
  });
}
