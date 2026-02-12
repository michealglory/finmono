import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";

export async function requireUser() {
  const session = await getSession();
  if (!session) {
    return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user: session, response: null };
}
