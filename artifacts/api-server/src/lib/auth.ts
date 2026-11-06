import { getAuth, verifyToken } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Primary path: clerkMiddleware verified via session cookie + dev-browser cookie.
  // This works when the Clerk dev browser cookie (__clerk_db_jwt) is fresh.
  const auth = getAuth(req);
  if (auth?.userId) {
    (req as any).clerkUserId = auth.userId;
    next();
    return;
  }

  // Fallback path: Bearer token in Authorization header.
  // When a bearer token is present, @clerk/express skips the dev-browser check,
  // so this path works even when __clerk_db_jwt is absent/stale.
  // On the frontend, setAuthTokenGetter(() => getToken()) populates this header.
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });
      (req as any).clerkUserId = payload.sub;
      next();
      return;
    } catch {
      // fall through to 401
    }
  }

  res.status(401).json({ error: "Unauthorized" });
}

export function getClerkUserId(req: Request): string | null {
  const auth = getAuth(req);
  if (auth?.userId) return auth.userId;
  return (req as any).clerkUserId ?? null;
}
