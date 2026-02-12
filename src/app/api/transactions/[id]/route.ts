import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";

const updateSchema = z.object({
  categoryId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const params = await context.params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.tagIds) {
    const ownedTags = await prisma.tag.count({
      where: { userId: user.userId, id: { in: parsed.data.tagIds }, archivedAt: null }
    });
    if (ownedTags !== parsed.data.tagIds.length) {
      return NextResponse.json({ error: "Invalid/archived tag in payload" }, { status: 400 });
    }
  }

  const transaction = await prisma.transaction.updateMany({
    where: { id: params.id, userId: user.userId },
    data: {
      categoryId: parsed.data.categoryId ?? undefined,
      notes: parsed.data.notes ?? undefined
    }
  });

  if (parsed.data.tagIds) {
    await prisma.transactionTag.deleteMany({ where: { transactionId: params.id } });
    if (parsed.data.tagIds.length > 0) {
      await prisma.transactionTag.createMany({
        data: parsed.data.tagIds.map((tagId) => ({ transactionId: params.id, tagId })),
        skipDuplicates: true
      });
    }
  }

  return NextResponse.json({ updated: transaction.count });
}
