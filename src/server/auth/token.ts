import { SignJWT, jwtVerify } from "jose";

const encoder = new TextEncoder();
const secret = process.env.JWT_SECRET;

if (!secret) {
  throw new Error("JWT_SECRET environment variable is required");
}

const secretKey = encoder.encode(secret);

export const sessionCookieName = "ff_session";

export type SessionUser = {
  userId: string;
  email: string;
};

export async function createSessionToken(payload: SessionUser): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(secretKey);
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
    if (!payload.userId || !payload.email) {
      return null;
    }

    return {
      userId: String(payload.userId),
      email: String(payload.email)
    };
  } catch {
    return null;
  }
}
