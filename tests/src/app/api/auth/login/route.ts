import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { loginInput } from "@/lib/validation";
import { loginUser } from "@/services/auth-service";
import { getClientIp } from "@/lib/utils";

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const input = await readJson(request, loginInput);
    return ok(
      await loginUser(input, {
        ip: getClientIp(request.headers),
        userAgent: request.headers.get("user-agent") || undefined,
      }),
    );
  });
}
