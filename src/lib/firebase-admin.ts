import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

/** 後端使用的 Storage bucket 名稱（與前端 NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET 應一致） */
export function getStorageBucketName(): string {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  return (
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    process.env.FIREBASE_STORAGE_BUCKET ||
    (projectId ? `${projectId}.appspot.com` : "")
  );
}

/** 404 時可嘗試的另一種 bucket 名稱（Firebase 有 .firebasestorage.app 與 .appspot.com 兩種格式） */
export function getStorageBucketNameAlternate(bucketName: string): string | null {
  const projectId = process.env.FIREBASE_PROJECT_ID || bucketName.replace(/\.(firebasestorage\.app|appspot\.com)$/, "");
  if (!projectId) return null;
  if (bucketName.endsWith(".firebasestorage.app")) return `${projectId}.appspot.com`;
  if (bucketName.endsWith(".appspot.com")) return `${projectId}.firebasestorage.app`;
  return null;
}

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0] as App;
  }
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const storageBucket =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    process.env.FIREBASE_STORAGE_BUCKET ||
    (projectId ? `${projectId}.appspot.com` : undefined);
  return initializeApp({
    credential: cert({
      projectId,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
    ...(storageBucket && { storageBucket }),
  });
}

const adminApp = getAdminApp();
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);