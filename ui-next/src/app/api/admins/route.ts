import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/route";
import { getAdminRole, listAdminRecords, removeAdmin, upsertAdmin, type AdminRecord } from "@/lib/adminAccess";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

async function requireCurrentUser() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  const role = await getAdminRole(email);
  return { email, role };
}

async function getFeedbackStats() {
  const feedbackLogPath = path.join(process.cwd(), "data", "feedback-log.json");
  try {
    const raw = await fs.readFile(feedbackLogPath, "utf8");
    const allFeedback = JSON.parse(raw);
    if (!Array.isArray(allFeedback)) return { good: 0, bad: 0, total: 0, recent: [] };

    let good = 0;
    let bad = 0;
    for (const entry of allFeedback) {
      if (entry.feedback === "good") good++;
      else if (entry.feedback === "bad") bad++;
    }
    
    // Get the last 5 feedback entries
    const recent = allFeedback.slice(-5).reverse();
    return { good, bad, total: allFeedback.length, recent };
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return { good: 0, bad: 0, total: 0, recent: [] };
    }
    return { good: 0, bad: 0, total: 0, recent: [], error: "Failed to read feedback log." };
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
    feedbackStats: await getFeedbackStats(),
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
