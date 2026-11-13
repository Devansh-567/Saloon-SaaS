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
import { z } from "zod";
import { withApi, ok, readJson } from "@/lib/api";
import { forbidden, unauthorized } from "@/lib/errors";
import { getTenantContext, getVerifiedViewer } from "@/lib/auth";
import { switchSalon } from "@/services/auth-service";

const schema = z.object({ salonId: z.string().cuid() });

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const viewer = await getVerifiedViewer();
    if (!viewer) throw unauthorized();
    const context = await getTenantContext();
    if (!context) throw forbidden("No active salon membership");
    const { salonId } = await readJson(request, schema);
    const salon = await switchSalon(context, salonId);
    return ok({ salonId: salon.id, name: salon.name });
  });
}

