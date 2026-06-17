import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getAblyToken } from "@/lib/realtime/ably";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tokenRequest = await getAblyToken(user.id);
    return NextResponse.json(tokenRequest);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create Ably token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
