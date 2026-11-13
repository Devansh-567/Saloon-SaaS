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
// 2026 Devansh Singh
// Guru AI Technologies
 import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { passwordChangeInput } from "@/lib/validation";
import { changePassword } from "@/services/auth-service";

export async function PATCH(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant();
    await changePassword(context, await readJson(request, passwordChangeInput));
    return ok({ success: true });
  });
}

