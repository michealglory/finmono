import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth/require-user";
import { getTagImpactCounts } from "@/server/services/tag-management";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const params = await context.params;
  const counts = await getTagImpactCounts(user.userId, params.id);
  return NextResponse.json({ counts });
}
