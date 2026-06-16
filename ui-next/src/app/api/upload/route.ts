import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/route";

const adminEmails = (process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();

  if (!email || !adminEmails.includes(email)) {
    return NextResponse.json(
      { status: "error", message: "Admin authorization required for document upload." },
      { status: 403 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { status: "error", message: "No file was attached to the upload request." },
      { status: 400 }
    );
  }

  const backendFormData = new FormData();
  backendFormData.append("file", file, file.name);

  const uploadResponse = await fetch("http://127.0.0.1:8000/upload", {
    method: "POST",
    body: backendFormData,
  });

  const payload = await uploadResponse.json().catch(() => ({
    status: "error",
    message: "Upload service returned an unreadable response.",
  }));

  return NextResponse.json(payload, { status: uploadResponse.status });
}
