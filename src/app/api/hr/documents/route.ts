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
import { requireApiTenant } from "@/lib/auth";
import { badRequest } from "@/lib/errors";
import { uploadDocument } from "@/services/files";
import { attachEmployeeDocument } from "@/services/hr";

const KIND = ["AADHAAR", "PAN", "PHOTO", "CONTRACT", "OTHER"] as const;
type Kind = (typeof KIND)[number];

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant("hr.write");
    const form = await request.formData();
    const file = form.get("file");
    const membershipId = String(form.get("membershipId") || "");
    const title = String(form.get("title") || "").trim();
    const kind = String(form.get("kind") || "OTHER") as Kind;
    if (!(file instanceof File)) throw badRequest("Choose a file to upload");
    if (!membershipId) throw badRequest("Choose a staff member");
    if (!title) throw badRequest("Give the document a name");
    if (!KIND.includes(kind)) throw badRequest("Choose a valid document type");
    const asset = await uploadDocument(context, file);
    return ok(await attachEmployeeDocument(context, { membershipId, kind, title, fileId: asset.id }), 201);
  });
}

