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

