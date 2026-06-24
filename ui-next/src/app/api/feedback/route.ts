import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    const body = await req.json();
    const { messageId, feedback, reason, prompt, content } = body;

    if (!messageId) {
      return NextResponse.json({ message: "Missing required fields." }, { status: 400 });
    }

    if (feedback === null) {
      await prisma.botFeedback.deleteMany({
        where: { messageId },
      });

      return NextResponse.json({ success: true, data: null }, { status: 200 });
    }

    if (feedback !== "good" && feedback !== "bad") {
      return NextResponse.json({ message: "Invalid feedback value." }, { status: 400 });
    }

    const user = session?.user?.email
      ? await prisma.user.findUnique({ where: { email: session.user.email } })
      : null;

    await prisma.chatMessage.upsert({
      where: { id: messageId },
      update: {
        prompt: String(prompt || "Feedback source prompt unavailable"),
        response: String(content || ""),
        userId: user?.id || null,
      },
      create: {
        id: messageId,
        prompt: String(prompt || "Feedback source prompt unavailable"),
        response: String(content || ""),
        userId: user?.id || null,
      },
    });

    // Convert frontend input ("good"/"bad") to database strict strings ("GOOD"/"BAD")
    const voteString = feedback.toUpperCase();

    // Upsert maps logic: Agar feedback pehle se hai toh update, nahi toh naya create
    const feedbackRecord = await prisma.botFeedback.upsert({
      where: { messageId: messageId },
      update: {
        vote: voteString,
        reason: reason || null,
      },
      create: {
        messageId: messageId,
        vote: voteString,
        reason: reason || null,
      },
    });

    return NextResponse.json({ success: true, data: feedbackRecord }, { status: 200 });
  } catch (error: unknown) {
    console.error("Telemetry Logging Error:", error);
    return NextResponse.json({ message: "Internal Server Error Matrix Fallback." }, { status: 500 });
  }
}
