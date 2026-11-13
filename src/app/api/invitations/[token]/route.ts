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
import { getInvitationInfo } from "@/services/team";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withApi(request, async () => {
    const { token } = await params;
    return ok(await getInvitationInfo(token));
  });
}
