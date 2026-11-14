import { NextRequest } from "next/server";
import { withApi, ok } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { deleteAttendance } from "@/services/hr";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("hr.write");
    const { id } = await params;
    return ok(await deleteAttendance(context, id));
  });
}
