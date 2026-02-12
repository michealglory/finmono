import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";

export async function GET() {
  const session = await getSession();
  return NextResponse.json({ session });
}
