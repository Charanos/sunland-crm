import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { setSession } from "@/lib/auth/session";
import { getDefaultPortal } from "@/lib/auth/roles";
import type { UserRole } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { role } = await request.json();

    let user: any = null;
    try {
      const [dbUser] = await db
        .select()
        .from(users)
        .where(eq(users.role, role as (typeof users.$inferInsert)["role"]))
        .limit(1);
      user = dbUser;
    } catch (dbErr) {
      console.warn("DB lookup failed in emulation, falling back to mock user:", dbErr);
    }

    if (!user) {
      user = {
        id: `usr-mock-${role}`,
        email: `${role}@sunland.co.ke`,
        name: role.split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
        role: role as UserRole,
      };
    }

    await setSession(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as UserRole,
      },
      {
        ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        userAgent: request.headers.get("user-agent") ?? undefined,
      },
    );

    const redirectPath = getDefaultPortal(user.role as UserRole);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        portal: redirectPath,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Access delegation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
