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
import { requireApiTenant, requirePermission } from "@/lib/auth";
import { sendInvoiceNotification } from "@/services/notifications";

const schema = z.object({ channel: z.enum(["EMAIL", "SMS", "WHATSAPP"]) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("notifications.send");
    requirePermission(context, "billing.read");
    const { id } = await params;
    const { channel } = await readJson(request, schema);
    const log = await sendInvoiceNotification(context, id, channel);
    return ok(log);
  });
}
