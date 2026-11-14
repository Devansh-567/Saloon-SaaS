import { NextRequest } from "next/server";
import { withApi, ok } from "@/lib/api";
import { getInvitationInfo } from "@/services/team";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withApi(request, async () => {
    const { token } = await params;
    return ok(await getInvitationInfo(token));
  });
}
