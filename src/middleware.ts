import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sessionCookieName, verifySessionToken } from "@/server/auth/token";

const PUBLIC_PATHS = ["/login", "/register", "/api/auth/login", "/api/auth/register", "/api/auth/session"];

export async function middleware(request: NextRequest) {
  if (PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/_next") || request.nextUrl.pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
