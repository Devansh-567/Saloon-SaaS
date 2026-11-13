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
import { forgotPasswordInput } from "@/lib/validation";
import { requestPasswordReset } from "@/services/password-reset";
import { getClientIp } from "@/lib/utils";

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const input = await readJson(request, forgotPasswordInput);
    return ok(await requestPasswordReset(input, { ip: getClientIp(request.headers) }));
  });
}

