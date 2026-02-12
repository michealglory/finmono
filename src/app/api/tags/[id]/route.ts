import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";
import { deleteTag } from "@/server/services/tag-management";

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  color: z.string().nullable().optional(),
  archivedAt: z.string().nullable().optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const params = await context.params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const tag = await prisma.tag.updateMany({
    where: { id: params.id, userId: user.userId },
    data: {
      name: parsed.data.name,
      color: parsed.data.color,
      archivedAt: parsed.data.archivedAt === undefined ? undefined : parsed.data.archivedAt ? new Date(parsed.data.archivedAt) : null
    }
  });

  return NextResponse.json({ updated: tag.count });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const params = await context.params;

  try {
    const result = await deleteTag(user.userId, params.id);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Delete failed" }, { status: 400 });
  }
}
