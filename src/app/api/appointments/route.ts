import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { appointmentInput } from "@/lib/validation";
import { createAppointment } from "@/services/appointments";

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant("appointments.write");
    const input = await readJson(request, appointmentInput);
    return ok(await createAppointment(context, input), 201);
  });
}
