import "server-only";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { prisma } from "./prisma";
import { env } from "./env";
import { badRequest, notFound } from "./errors";

export type AllowedFileKind = "LOGO" | "DOCUMENT" | "INVOICE" | "RECEIPT";

const allowedTypes = {
  LOGO: ["image/png", "image/jpeg", "image/webp"],
  DOCUMENT: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
};

function folderFor(kind: AllowedFileKind) {
  return kind === "LOGO" ? "logos" : kind === "INVOICE" || kind === "RECEIPT" ? "invoices" : "documents";
}

function detectType(bytes: Uint8Array): { mime: string; ext: string } | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { mime: "image/png", ext: "png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  if (bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") {
    return { mime: "application/pdf", ext: "pdf" };
  }
  return null;
}

export async function saveUpload(input: { salonId: string; kind: "LOGO" | "DOCUMENT"; file: File }) {
  if (!input.file.name || input.file.size <= 0) throw badRequest("File is required");
  const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
  if (input.file.size > maxBytes) throw badRequest(`File must be ${env.MAX_UPLOAD_MB} MB or smaller`);
  const bytes = Buffer.from(await input.file.arrayBuffer());
  const detected = detectType(bytes);
  if (!detected) throw badRequest("Unsupported file content");
  if (!allowedTypes[input.kind].includes(detected.mime) || !allowedTypes[input.kind].includes(input.file.type)) {
    throw badRequest("File type is not allowed");
  }
  const storedName = `${randomUUID()}.${detected.ext}`;
  const relativePath = path.posix.join("salons", input.salonId, folderFor(input.kind), storedName);
  await prisma.storedBlob.create({ data: { path: relativePath, salonId: input.salonId, data: bytes } });
  return {
    relativePath,
    storedName,
    size: bytes.length,
    mimeType: detected.mime,
    originalName: input.file.name.slice(0, 200),
  };
}

export async function readStoredFile(relativePath: string) {
  const blob = await prisma.storedBlob.findUnique({ where: { path: relativePath } });
  if (!blob) throw notFound("File not found");
  return Buffer.from(blob.data);
}

export async function removeStoredFile(relativePath: string) {
  await prisma.storedBlob.deleteMany({ where: { path: relativePath } });
}
