import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let _adminApp: App | null = null;

function getAdminApp(): App {
  if (_adminApp) return _adminApp;
  if (getApps().length > 0) {
    _adminApp = getApps()[0] as App;
    return _adminApp;
  }
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  _adminApp = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
  return _adminApp;
}

/** 延遲初始化，避免 build 時因無 env 而失敗 */
export const adminAuth = new Proxy({} as ReturnType<typeof getAuth>, {
  get(_, prop) {
    return (getAuth(getAdminApp()) as unknown as Record<string | symbol, unknown>)[prop];
  },
});
export const adminDb = new Proxy({} as ReturnType<typeof getFirestore>, {
  get(_, prop) {
    return (getFirestore(getAdminApp()) as unknown as Record<string | symbol, unknown>)[prop];
  },
});
