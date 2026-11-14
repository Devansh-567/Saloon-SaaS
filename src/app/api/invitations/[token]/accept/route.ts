import { NextRequest } from "next/server";
import { withApi, ok } from "@/lib/api";
import { acceptInviteSchema, acceptInvitation } from "@/services/team";
import { createSession, getVerifiedViewer, setActiveSalon } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils";

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withApi(request, async () => {
    const { token } = await params;
    await rateLimit(`invite:${getClientIp(request.headers)}`, 20, 60 * 60_000);
    let body: unknown = {};
    if ((request.headers.get("content-type") || "").includes("application/json")) {
      body = await request.json().catch(() => ({}));
    }
    const input = acceptInviteSchema.parse(body);
    const viewer = await getVerifiedViewer();
    const result = await acceptInvitation(token, input, viewer?.user.id);
    if (viewer && !result.requiresLogin) {
      await setActiveSalon(viewer.session.id, result.salonId);
    } else if (result.requiresLogin) {
      const session = await createSession(result.userId, true, {
        ip: getClientIp(request.headers),
        userAgent: request.headers.get("user-agent") || undefined,
      });
      await setActiveSalon(session.id, result.salonId);
    }
    return ok({ ...result, requiresLogin: false, redirectTo: "/dashboard" });
  });
}
