/// <reference path="../../../types/bcryptjs.d.ts" />
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import bcrypt from "bcryptjs";

const COUNTER_REF = "counters/accountNumber";
const USERS_REF = "users";

export async function POST(request: Request) {
  try {
    const { name, password } = (await request.json()) as {
      name?: string;
      password?: string;
    };

    if (!name?.trim() || !password?.trim()) {
      return NextResponse.json(
        { error: "請填寫名字與密碼" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "密碼至少 6 個字元" },
        { status: 400 }
      );
    }

    const db = adminDb;

    // 取得並遞增帳號編號
    const counterRef = db.collection("counters").doc("accountNumber");
    const counterSnap = await counterRef.get();
    const nextNum = counterSnap.exists
      ? (counterSnap.data()?.value ?? 0) + 1
      : 1;

    const accountNumber = String(nextNum).padStart(4, "0"); // 0001, 0002...

    const passwordHash = await bcrypt.hash(password, 10);

    const userRef = db.collection(USERS_REF).doc(accountNumber);
    await userRef.set({
      name: name.trim(),
      passwordHash,
      role: "member",
      createdAt: new Date(),
    });

    await counterRef.set({ value: nextNum }, { merge: true });

    return NextResponse.json({
      success: true,
      accountNumber,
      message: `註冊成功，您的帳號編號為：${accountNumber}，請妥善保存並用於登入。`,
    });
  } catch (e) {
    console.error("Register error:", e);
    return NextResponse.json(
      { error: "註冊失敗，請稍後再試" },
      { status: 500 }
    );
  }
}
