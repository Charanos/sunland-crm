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

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.role, role as any))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "Profile not configured" }, { status: 404 });
    }

    await setSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
    });

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
