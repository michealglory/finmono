import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";

const schema = z.object({
  name: z.string().min(2),
  parentId: z.string().optional().nullable(),
  level: z.number().min(1).max(3)
});

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  const categories = await prisma.category.findMany({
    where: { userId: user.userId },
    include: { children: true },
    orderBy: [{ level: "asc" }, { name: "asc" }]
  });

  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const slug = `${parsed.data.name}-${Date.now()}`.toLowerCase().replace(/\s+/g, "-");

  const category = await prisma.category.create({
    data: {
      userId: user.userId,
      name: parsed.data.name,
      slug,
      parentId: parsed.data.parentId || null,
      level: parsed.data.level
    }
  });

  return NextResponse.json({ category }, { status: 201 });
}
