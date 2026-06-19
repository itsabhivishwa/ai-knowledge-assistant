import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    // 1. Basic validation node structural tracking
    if (!email || !password) {
      return NextResponse.json(
        { message: "Email and Password variables are strictly mandatory nodes." },
        { status: 400 }
      );
    }

    const sanitizedEmail = email.toLowerCase().trim();

    // 2. Check duplicate constraints check inside identity tables
    const existingUser = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "Corporate identity node already registered inside security tables." },
        { status: 400 }
      );
    }

    // 3. Mathematical Encryption: Hash raw string password with 10 salt rounds context
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Database Transaction Node: Commit user schema layout directly to Cloud database table
    const newUser = await prisma.user.create({
      data: {
        name: name || null,
        email: sanitizedEmail,
        password: hashedPassword,
        role: "user", // Default identity access set to base level
      },
    });

    return NextResponse.json(
      { 
        message: "User registration sequence synchronized securely.", 
        userId: newUser.id 
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error("Signup Core Matrix Crash Log: ", error);
    return NextResponse.json(
      { message: "Internal Authentication System Overload Error nodes." },
      { status: 500 }
    );
  }
}