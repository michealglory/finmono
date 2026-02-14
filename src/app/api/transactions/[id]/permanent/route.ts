import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth/require-user";
import { hardDeleteTransaction } from "@/server/services/transaction-lifecycle";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const params = await context.params;

  try {
    const result = await hardDeleteTransaction(user.userId, params.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Permanent delete failed" }, { status: 400 });
  }
}
