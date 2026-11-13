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
import { platformSettingsUpdate } from "@/lib/validation";
import { updatePlatformSettings } from "@/services/platform";

export async function PATCH(request: NextRequest) {
  return withApi(request, async () => {
    const viewer = await requirePlatformApi();
    return ok(await updatePlatformSettings(viewer.user.id, await readJson(request, platformSettingsUpdate)));
  });
}

