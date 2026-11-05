import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { inviteInput } from "@/lib/validation";
import { inviteMember } from "@/services/team";
import { env } from "@/lib/env";

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant("team.write");
    const input = await readJson(request, inviteInput);
    const invitation = await inviteMember(context, input);
    return ok(
      {
        ...invitation,
        inviteUrl: `${env.APP_URL.replace(/\/$/, "")}/invite/${invitation.token}`,
      },
      201,
    );
  });
}
