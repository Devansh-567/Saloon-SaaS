import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

// The company logo is whichever of these files exists in public/brand/ (first match wins).
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
      // try the next file name
    }
  }
  return new Response("Logo not found", { status: 404 });
}
