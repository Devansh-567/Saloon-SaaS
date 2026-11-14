import { NextRequest } from "next/server";
import { withApi, ok } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { uploadSalonLogo } from "@/services/files";
import { badRequest } from "@/lib/errors";

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant("settings.write");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw badRequest("Select a logo file");
    const asset = await uploadSalonLogo(context, file);
    return ok(asset, 201);
  });
}
