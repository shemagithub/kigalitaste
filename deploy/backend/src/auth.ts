import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { one } from "./db.ts";

const JWT_SECRET = process.env.JWT_SECRET || "kigali-taste-mvp-secret";

export type AuthUser = {
  id: number;
  role: "customer" | "vendor" | "admin";
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  emailVerified: number;
  avatarUrl?: string | null;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: { id: number; role: string }) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

export function publicUser(user: AuthUser) {
  return {
    id: user.id,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    emailVerified: Boolean(user.emailVerified),
    avatarUrl: user.avatarUrl || null,
  };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    res.status(401).json({ error: "Please log in" });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: number };
    const user = await one<AuthUser>("SELECT * FROM users WHERE id = ?", [payload.id]);
    if (!user) {
      res.status(401).json({ error: "Please log in" });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Please log in again" });
  }
}

export function requireRole(...roles: AuthUser["role"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "You cannot open this page" });
      return;
    }
    next();
  };
}

export function vendorRow(userId: number) {
  return one<{
    id: number;
    userId: number;
    businessName: string;
    businessAddress: string;
    businessType: string;
    nationalIdUrl: string;
    rdbCertificateUrl: string;
    status: string;
    rejectionReason: string | null;
    suspended: number;
  }>("SELECT * FROM vendors WHERE userId = ?", [userId]);
}
