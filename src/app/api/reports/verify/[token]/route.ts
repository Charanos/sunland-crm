import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reportExports, users } from "@/db/schema";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const resolvedParams = await params;
    const token = resolvedParams.token;

    // Fetch snapshot details with generator name
    const [report] = await db
      .select({
        id: reportExports.id,
        entityId: reportExports.entityId,
        reportType: reportExports.reportType,
        generatedAt: reportExports.createdAt,
        generatedByName: users.name,
        expiresAt: reportExports.expiresAt,
        snapshot: reportExports.snapshot,
      })
      .from(reportExports)
      .innerJoin(users, eq(reportExports.generatedById, users.id))
      .where(eq(reportExports.verificationToken, token))
      .limit(1);

    if (!report) {
      return NextResponse.json(
        { authentic: false, error: "Document verification token not found or invalid." },
        { status: 404 }
      );
    }

    // Check expiration if applicable
    if (report.expiresAt && new Date() > new Date(report.expiresAt)) {
      return NextResponse.json(
        { authentic: false, error: "Verification token has expired." },
        { status: 410 }
      );
    }

    return NextResponse.json({
      authentic: true,
      reportType: report.reportType,
      generatedAt: report.generatedAt,
      generatedByName: report.generatedByName,
      snapshot: report.snapshot,
    });
  } catch (error) {
    console.error("Verification API Error:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
