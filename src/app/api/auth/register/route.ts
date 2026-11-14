import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { registerInput } from "@/lib/validation";
import { registerOwner } from "@/services/auth-service";
import { getClientIp } from "@/lib/utils";

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const input = await readJson(request, registerInput);
    const result = await registerOwner(input, {
      ip: getClientIp(request.headers),
      userAgent: request.headers.get("user-agent") || undefined,
    });
    return ok({ salonId: result.salon.id, redirectTo: "/dashboard" }, 201);
  });
}
