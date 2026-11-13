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
 import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const CANDIDATES: Array<[string, string]> = [
  ["logo.png", "image/png"],
  ["logo.webp", "image/webp"],
  ["logo.jpg", "image/jpeg"],
  ["logo.jpeg", "image/jpeg"],
  ["logo.svg", "image/svg+xml"],
];

export async function GET() {
  for (const [file, type] of CANDIDATES) {
    try {
      const bytes = await readFile(path.join(process.cwd(), "public", "brand", file));
      return new Response(new Uint8Array(bytes), {
        headers: { "Content-Type": type, "Cache-Control": "public, max-age=300" },
      });
    } catch {
    }
  }
  return new Response("Logo not found", { status: 404 });
}

