import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth/require-user";
import { getCategoryImpactCounts } from "@/server/services/category-management";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const params = await context.params;
  const counts = await getCategoryImpactCounts(user.userId, params.id);
  return NextResponse.json({ counts });
}
