import { NextRequest } from "next/server";
import { withApi, ok } from "@/lib/api";
import { destroySession, getVerifiedViewer } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const viewer = await getVerifiedViewer();
    if (viewer) {
      await recordAudit({
        salonId: viewer.session.salonId,
        actorUserId: viewer.user.id,
        action: "auth.logout",
        entityType: "User",
        entityId: viewer.user.id,
      });
    }
    await destroySession();
    return ok({ success: true });
  });
}
