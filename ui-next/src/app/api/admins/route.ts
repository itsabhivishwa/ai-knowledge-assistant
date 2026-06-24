import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/route";
import { getAdminRole, listAdminRecords, removeAdmin, upsertAdmin, type AdminRecord } from "@/lib/adminAccess";
import { prisma } from "@/lib/prisma"; // ⚡ INJECTED PRISMA CONNECTION FOR GLOBAL ACCURACY LIVE TRACKING

export const runtime = "nodejs";

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

async function requireCurrentUser() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  const role = await getAdminRole(email);
  return { email, role };
}

// 🤖 LIVE DATABASE TELEMETRY AGGREGATION CORE
async function getFeedbackStats() {
  try {
    // Direct database registry node hits safely
    const allFeedbacks = await prisma.botFeedback.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        message: true // Pulls prompt matrix safely via dynamic schemas mapping
      }
    });

    const goodCount = allFeedbacks.filter(f => f.vote === "GOOD").length;
    const badCount = allFeedbacks.filter(f => f.vote === "BAD").length;

    // Format top 5 structural recent records directly matching front-end layouts
    const recentLogs = allFeedbacks.slice(0, 5).map(f => ({
      feedback: f.vote.toLowerCase(), // Converts strict DB "GOOD" back to frontend format
      content: f.message?.prompt || "Structured company framework log query node",
      timestamp: f.createdAt.toISOString()
    }));

    return { 
      good: goodCount, 
      bad: badCount, 
      total: allFeedbacks.length, 
      recent: recentLogs 
    };
  } catch (error) {
    console.error("Telemetry Registry Matrix Read Exception:", error);
    return { good: 0, bad: 0, total: 0, recent: [] };
  }
}

export async function GET() {
  const { email, role } = await requireCurrentUser();

  if (!email) {
    return NextResponse.json({ status: "error", message: "Authentication required." }, { status: 401 });
  }

  const isAdmin = role === "admin";

  return NextResponse.json({
    status: "ok",
    currentUserRole: role || "user",
    isAdmin: isAdmin,
    feedbackStats: await getFeedbackStats(), // ⚡ Now dynamically fetches global realtime database counts
    admins: isAdmin ? await listAdminRecords() : [],
  });
}

export async function POST(request: Request) {
  const { email: actorEmail, role: actorRole } = await requireCurrentUser();

  if (!actorEmail || actorRole !== "admin") {
    return NextResponse.json({ status: "error", message: "Admin authorization required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));

  try {
    const record = await upsertAdmin(String(body.email || ""), actorEmail);
    return NextResponse.json({ status: "ok", admin: record, admins: await listAdminRecords() });
  } catch (error: unknown) {
    return NextResponse.json({ status: "error", message: getErrorMessage(error, "Unable to save admin.") }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const { email: actorEmail, role: actorRole } = await requireCurrentUser();

  if (!actorEmail || actorRole !== "admin") {
    return NextResponse.json({ status: "error", message: "Admin authorization required." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const targetEmail = searchParams.get("email") || "";

  try {
    await removeAdmin(targetEmail, actorEmail);
    return NextResponse.json({ status: "ok", admins: await listAdminRecords() });
  } catch (error: unknown) {
    return NextResponse.json({ status: "error", message: getErrorMessage(error, "Unable to remove admin.") }, { status: 400 });
  }
}