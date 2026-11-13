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
import { requirePlatformApi } from "@/lib/auth";
import { subscriptionInput } from "@/lib/validation";
import { setSubscription } from "@/services/platform";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const viewer = await requirePlatformApi();
    const { id } = await params;
    return ok(await setSubscription(viewer.user.id, id, await readJson(request, subscriptionInput)));
  });
}
