import { NextResponse } from "next/server";
import { adminAuth, adminDb, adminStorage } from "@/lib/firebase-admin";

/**
 * GET /api/admin/recordings?weekId=xxx
 * 僅管理員：列出該週所有使用者的錄音路徑，供前端用 getDownloadURL 播放（管理員 token 可讀）
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const { uid } = await adminAuth.verifyIdToken(token);
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const role = (userDoc.data()?.role as string) ?? "member";
    if (role !== "admin") {
      return NextResponse.json({ error: "僅管理員可存取" }, { status: 403 });
    }

    const weekId = new URL(request.url).searchParams.get("weekId");
    if (!weekId) {
      return NextResponse.json({ error: "請提供 weekId" }, { status: 400 });
    }

    const bucket = adminStorage.bucket();
    const [files] = await bucket.getFiles({ prefix: "recordings/" });

    const list: { path: string; userId: string; weekId: string; name: string }[] = [];
    for (const file of files) {
      const path = file.name;
      const parts = path.split("/");
      if (parts.length >= 3 && parts[0] === "recordings") {
        const fileUserId = parts[1];
        const fileWeekId = parts[2];
        const fileName = parts[3] ?? path;
        if (fileWeekId === weekId) {
          list.push({
            path,
            userId: fileUserId,
            weekId: fileWeekId,
            name: fileName,
          });
        }
      }
    }

    list.sort((a, b) => a.userId.localeCompare(b.userId) || a.name.localeCompare(b.name));

    const userIds = [...new Set(list.map((r) => r.userId))];
    const usersSnap = await adminDb.collection("users").get();
    const nameByUid: Record<string, string> = {};
    usersSnap.docs.forEach((d) => {
      nameByUid[d.id] = (d.data().name as string) ?? d.id;
    });

    const recordingsWithName = list.map((r) => ({
      ...r,
      userName: nameByUid[r.userId] ?? r.userId,
    }));

    return NextResponse.json({ weekId, recordings: recordingsWithName });
  } catch (e) {
    console.error("Admin recordings API error:", e);
    return NextResponse.json(
      { error: "無法取得錄音列表" },
      { status: 500 }
    );
  }
}
