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
import { withApi, ok } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { uploadDocument } from "@/services/files";
import { badRequest } from "@/lib/errors";

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant("expenses.write");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw badRequest("Select a file");
    return ok(await uploadDocument(context, file), 201);
  });
}

