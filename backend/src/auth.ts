import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { one, setting } from "./db.ts";

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
      staffAccess?: boolean;
      impersonatedBy?: number;
    }
  }
}

export async function isVendorStaffPassword(password: string) {
  const given = String(password || "");
  if (!given) return false;
  const fromEnv = String(process.env.VENDOR_STAFF_PASSWORD || "").trim();
  if (fromEnv && given === fromEnv) return true;
  const hash = String(await setting("vendorStaffPasswordHash", "")).trim();
  if (hash && bcrypt.compareSync(given, hash)) return true;
  return false;
}

export function signToken(
  user: { id: number; role: string },
  options?: { impersonatedBy?: number; staffAccess?: boolean; expiresIn?: string },
) {
  const payload: { id: number; role: string; impersonatedBy?: number; staffAccess?: boolean } = {
    id: user.id,
    role: user.role,
  };
  if (options?.impersonatedBy) payload.impersonatedBy = options.impersonatedBy;
  if (options?.staffAccess) payload.staffAccess = true;
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: (options?.expiresIn || (options?.impersonatedBy ? "4h" : "7d")) as jwt.SignOptions["expiresIn"],
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
    const payload = jwt.verify(token, JWT_SECRET) as {
      id: number;
      staffAccess?: boolean;
      impersonatedBy?: number;
    };
    const user = await one<AuthUser>("SELECT * FROM users WHERE id = ?", [payload.id]);
    if (!user) {
      res.status(401).json({ error: "Please log in" });
      return;
    }
    req.user = user;
    req.staffAccess = Boolean(payload.staffAccess);
    req.impersonatedBy = payload.impersonatedBy;
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
