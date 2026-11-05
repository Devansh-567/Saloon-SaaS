import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { env } from "./env";
import { badRequest, forbidden } from "./errors";

export type AllowedFileKind = "LOGO" | "DOCUMENT" | "INVOICE" | "RECEIPT";

const allowedTypes = {
  LOGO: ["image/png", "image/jpeg", "image/webp"],
  DOCUMENT: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
};

export const storageRoot = path.resolve(env.STORAGE_ROOT);

function folderFor(kind: AllowedFileKind) {
  return kind === "LOGO" ? "logos" : kind === "INVOICE" || kind === "RECEIPT" ? "invoices" : "documents";
}

export async function ensureStorage(salonId?: string) {
  await mkdir(storageRoot, { recursive: true, mode: 0o700 });
  if (!salonId) return;
  await Promise.all(
    ["logos", "documents", "invoices"].map((folder) =>
      mkdir(path.join(storageRoot, "salons", salonId, folder), { recursive: true, mode: 0o700 }),
    ),
  );
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

export function safeRelativePath(relativePath: string) {
  if (relativePath.includes("\0") || path.isAbsolute(relativePath)) throw forbidden("Invalid file path");
  const resolved = path.resolve(storageRoot, relativePath);
  if (!resolved.startsWith(storageRoot + path.sep)) throw forbidden("Invalid file path");
  return resolved;
}

export async function saveBuffer(input: {
  salonId: string;
  kind: AllowedFileKind;
  bytes: Buffer;
  mime: string;
  ext: string;
  originalName: string;
}) {
  await ensureStorage(input.salonId);
  const filename = `${randomUUID()}.${input.ext}`;
  const relativePath = path.posix.join("salons", input.salonId, folderFor(input.kind), filename);
  const absolute = safeRelativePath(relativePath);
  await writeFile(absolute, input.bytes, { mode: 0o600, flag: "wx" });
  return { relativePath, storedName: filename };
}

export async function saveUpload(input: {
  salonId: string;
  kind: "LOGO" | "DOCUMENT";
  file: File;
}) {
  if (!input.file.name || input.file.size <= 0) throw badRequest("File is required");
  const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
  if (input.file.size > maxBytes) throw badRequest(`File must be ${env.MAX_UPLOAD_MB} MB or smaller`);
  const bytes = Buffer.from(await input.file.arrayBuffer());
  const detected = detectType(bytes);
  if (!detected) throw badRequest("Unsupported file content");
  if (!allowedTypes[input.kind].includes(detected.mime) || !allowedTypes[input.kind].includes(input.file.type)) {
    throw badRequest("File type is not allowed");
  }
  const saved = await saveBuffer({
    salonId: input.salonId,
    kind: input.kind,
    bytes,
    mime: detected.mime,
    ext: detected.ext,
    originalName: input.file.name,
  });
  return { ...saved, size: bytes.length, mimeType: detected.mime, originalName: input.file.name.slice(0, 200) };
}

export async function writeGeneratedFile(input: {
  salonId: string;
  kind: "INVOICE" | "RECEIPT";
  basename: string;
  bytes: Buffer;
  mime: string;
  ext: string;
  existingPath?: string | null;
}) {
  await ensureStorage(input.salonId);
  const relativePath =
    input.existingPath ||
    path.posix.join("salons", input.salonId, "invoices", `${input.basename}-${randomUUID()}.${input.ext}`);
  const absolute = safeRelativePath(relativePath);
  await writeFile(absolute, input.bytes, { mode: 0o600 });
  return { relativePath, storedName: path.basename(relativePath) };
}

export async function readStoredFile(relativePath: string) {
  return readFile(safeRelativePath(relativePath));
}

export async function removeStoredFile(relativePath: string) {
  await unlink(safeRelativePath(relativePath)).catch(() => {});
}
