import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";

const schema = z.object({
  categoryId: z.string(),
  keyword: z.string().min(2),
  priority: z.number().int().min(1).max(1000).default(100)
});

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  const rules = await prisma.classificationRule.findMany({
    where: { userId: user.userId },
    include: { category: true },
    orderBy: { priority: "asc" }
  });

  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const rule = await prisma.classificationRule.create({
    data: {
      userId: user.userId,
      categoryId: parsed.data.categoryId,
      keyword: parsed.data.keyword,
      priority: parsed.data.priority
    }
  });

  return NextResponse.json({ rule }, { status: 201 });
}
