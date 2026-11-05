import { NextRequest, NextResponse } from "next/server";
import { withApi } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { getInvoicePdfDownload } from "@/services/invoice-pdf";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("billing.read");
    const { id } = await params;
    // Built on the fly: works on hosts where files cannot be saved permanently.
    const { bytes, filename } = await getInvoicePdfDownload(id, context);
    const inline = request.nextUrl.searchParams.get("view") === "1";
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(bytes.length),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
