import "server-only";

import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { query } from "@/lib/db";
import { HttpError } from "@/lib/http";
import type { Role, SessionUser } from "@/lib/types";

const SESSION_COOKIE = "cctv_session";
const APP_SESSION_COOKIE = "cctv_app_session";
const SESSION_DAYS = 7;

type UserRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  status: "active" | "inactive";
};

type SessionPayload = JWTPayload & {
  userId: string;
  role: Role;
};

function getEncodedSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing SESSION_SECRET");
  }

  return new TextEncoder().encode(secret);
}

function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
  };
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

async function signSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getEncodedSecret());
}

async function sessionCookieName() {
  const headerStore = await headers();
  if (headerStore.get("x-cctv-client") === "app") return APP_SESSION_COOKIE;

  const referer = headerStore.get("referer");
  if (referer) {
    try {
      if (new URL(referer).pathname.startsWith("/app/")) return APP_SESSION_COOKIE;
    } catch {
      // Ignore malformed referer values.
    }
  }

  return SESSION_COOKIE;
}

async function readSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(await sessionCookieName())?.value;
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getEncodedSecret(), {
      algorithms: ["HS256"],
    });
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(user: SessionUser) {
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const token = await signSession({ userId: user.id, role: user.role });
  const cookieStore = await cookies();

  cookieStore.set(await sessionCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires,
    path: "/",
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(await sessionCookieName());
}

export const getCurrentUser = cache(async () => {
  const session = await readSession();
  if (!session?.userId) {
    return null;
  }

  const result = await query<UserRow>(
    `select id, full_name, email, phone, role, status
     from users
     where id = $1 and status = 'active'
     limit 1`,
    [session.userId],
  );

  const user = result.rows[0];
  return user ? toSessionUser(user) : null;
});

export async function requireUser(roles?: Role[]) {
  const user = await getCurrentUser();
  if (!user) {
    throw new HttpError(401, "Bạn cần đăng nhập");
  }

  if (roles && !roles.includes(user.role)) {
    throw new HttpError(403, "Bạn không có quyền thực hiện thao tác này");
  }

  return user;
}

export async function loginWithPassword(identifier: string, password: string) {
  const result = await query<UserRow & { password_hash: string }>(
    `select id, full_name, email, phone, role, status, password_hash
     from users
     where lower(coalesce(email, '')) = lower($1) or phone = $1
     limit 1`,
    [identifier],
  );

  const user = result.rows[0];
  if (!user || user.status !== "active") {
    throw new HttpError(401, "Sai tài khoản hoặc mật khẩu");
  }

  const passwordMatches = await verifyPassword(password, user.password_hash);
  if (!passwordMatches) {
    throw new HttpError(401, "Sai tài khoản hoặc mật khẩu");
  }

  return toSessionUser(user);
}
