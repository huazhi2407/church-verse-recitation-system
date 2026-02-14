/// <reference path="../../../types/bcryptjs.d.ts" />
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import bcrypt from "bcryptjs";

const USERS_REF = "users";

export async function POST(request: Request) {
  try {
    const { accountNumber, password } = (await request.json()) as {
      accountNumber?: string;
      password?: string;
    };

    const num = accountNumber?.trim();
    if (!num || !password?.trim()) {
      return NextResponse.json(
        { error: "請填寫帳號編號與密碼" },
        { status: 400 }
      );
    }

    const db = adminDb;
    const userRef = db.collection(USERS_REF).doc(num);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json(
        { error: "帳號編號或密碼錯誤" },
        { status: 401 }
      );
    }

    const data = userSnap.data()!;
    const passwordHash = data.passwordHash as string;
    const match = await bcrypt.compare(password, passwordHash);

    if (!match) {
      return NextResponse.json(
        { error: "帳號編號或密碼錯誤" },
        { status: 401 }
      );
    }

    // 使用帳號編號作為 Firebase Auth uid，發放 custom token
    const customToken = await adminAuth.createCustomToken(num);

    return NextResponse.json({
      success: true,
      token: customToken,
    });
  } catch (e) {
    console.error("Login error:", e);
    return NextResponse.json(
      { error: "登入失敗，請稍後再試" },
      { status: 500 }
    );
  }
}
