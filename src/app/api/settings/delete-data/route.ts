import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";
import { clearSessionCookie } from "@/server/auth/session";

export async function POST() {
  const { user, response } = await requireUser();
  if (!user) return response;

  const uploads = await prisma.uploadedFile.findMany({ where: { userId: user.userId } });
  await Promise.all(
    uploads.map((upload) => fs.unlink(upload.path).catch(() => undefined))
  );

  await prisma.user.delete({ where: { id: user.userId } });
  await clearSessionCookie();

  return NextResponse.json({ ok: true });
}
