import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

/**
 * GET /api/progress?weekId=xxx
 * 需帶 Authorization: Bearer <Firebase ID Token>
 * 一般使用者：回傳自己的該週簽到狀態
 * 管理員：回傳所有使用者的該週簽到狀態（用於過曆表格）
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const { uid } = await adminAuth.verifyIdToken(token);
    const weekId = new URL(request.url).searchParams.get("weekId");
    if (!weekId) {
      return NextResponse.json({ error: "缺少 weekId" }, { status: 400 });
    }

    const userDoc = await adminDb.collection("users").doc(uid).get();
    const role = (userDoc.data()?.role as string) ?? "member";

    if (role === "admin") {
      const usersSnap = await adminDb.collection("users").get();
      const members: { uid: string; name: string; day1: boolean; day2: boolean; day3: boolean; day4: boolean; day5: boolean; day6: boolean; day7: boolean }[] = [];
      for (const u of usersSnap.docs) {
        const uData = u.data();
        const weekSnap = await adminDb
          .collection("checkins")
          .doc(u.id)
          .collection("weeks")
          .doc(weekId)
          .get();
        const wData = weekSnap.data() ?? {};
        members.push({
          uid: u.id,
          name: (uData.name as string) ?? "",
          day1: !!wData.day1,
          day2: !!wData.day2,
          day3: !!wData.day3,
          day4: !!wData.day4,
          day5: !!wData.day5,
          day6: !!wData.day6,
          day7: !!wData.day7,
        });
      }
      return NextResponse.json({ weekId, members });
    }

    const weekSnap = await adminDb
      .collection("checkins")
      .doc(uid)
      .collection("weeks")
      .doc(weekId)
      .get();
    const data = weekSnap.data() ?? {};
    const member = {
      uid,
      name: (userDoc.data()?.name as string) ?? "",
      day1: !!data.day1,
      day2: !!data.day2,
      day3: !!data.day3,
      day4: !!data.day4,
      day5: !!data.day5,
      day6: !!data.day6,
      day7: !!data.day7,
    };
    return NextResponse.json({ weekId, members: [member] });
  } catch (e) {
    console.error("Progress API error:", e);
    return NextResponse.json(
      { error: "無法取得進度" },
      { status: 500 }
    );
  }
}
