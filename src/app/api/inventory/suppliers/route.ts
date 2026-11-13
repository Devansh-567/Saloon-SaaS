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
import { supplierInput } from "@/lib/validation";
import { createSupplier } from "@/services/inventory";

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant("inventory.write");
    return ok(await createSupplier(context, await readJson(request, supplierInput)), 201);
  });
}

