import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { FileType } from "@prisma/client";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

function detectFileType(mimeType: string, filename: string): FileType {
  const lower = filename.toLowerCase();
  if (mimeType.includes("csv") || lower.endsWith(".csv")) return FileType.CSV;
  if (mimeType.includes("sheet") || lower.endsWith(".xlsx")) return FileType.XLSX;
  if (mimeType.includes("pdf") || lower.endsWith(".pdf")) return FileType.PDF;
  if (mimeType.startsWith("image/")) return FileType.IMAGE;
  return FileType.TEXT;
}

export async function saveUploadedFile(userId: string, file: File) {
  const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`File exceeds ${env.MAX_UPLOAD_MB}MB upload limit`);
  }

  const allowed = [
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/pdf",
    "text/plain",
    "image/png",
    "image/jpeg",
    "image/webp"
  ];

  if (!allowed.includes(file.type)) {
    throw new Error("File type not allowed");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name) || ".bin";
  const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
  const uploadDir = path.resolve(env.UPLOAD_DIR);
  await fs.mkdir(uploadDir, { recursive: true });
  const targetPath = path.join(uploadDir, filename);

  await fs.writeFile(targetPath, buffer);

  return prisma.uploadedFile.create({
    data: {
      userId,
      path: targetPath,
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      fileType: detectFileType(file.type, file.name)
    }
  });
}
