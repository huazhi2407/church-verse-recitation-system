# Firebase Storage 檢查清單

出現「音檔儲存失敗，請檢查 Firebase Storage 是否已啟用、環境變數與服務帳號權限」時，請依下列項目逐項檢查。

---

## 一、專案裡所有用到 Storage 的地方

| 檔案 | 用途 | 使用方式 |
|------|------|----------|
| `src/lib/firebase-admin.ts` | 後端 Firebase Admin | `getStorage(adminApp)`，需 `storageBucket` 或 env 有 bucket 名稱 |
| `src/lib/firebase.ts` | 前端 Firebase SDK | `getStorage(app)`，用 `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` |
| `src/app/api/verify-recitation-from-audio/route.ts` | 錄音上傳 | 後端：`adminStorage.bucket(bucketName)` → `fileRef.save()`、`getSignedUrl()` |
| `src/app/api/admin/recordings/route.ts` | 管理員列錄音 | 後端：`adminStorage.bucket(bucketName)` → `getFiles({ prefix: "recordings/" })` |
| `src/app/progress/page.tsx` | 週曆播放錄音 | 前端：`getDownloadURL(ref(storage, path))`，用前端 `storage`（同上 bucket） |

後端 bucket 名稱由 `getStorageBucketName()` 決定，依序為：  
`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` → `FIREBASE_STORAGE_BUCKET` → `{FIREBASE_PROJECT_ID}.appspot.com`。

---

## 二、你要檢查的「軟體／服務」

### 1. Firebase Console（瀏覽器）

- [ ] **Storage 已啟用**  
  左側 **Build** → **Storage** → 若顯示「開始使用」，點下去並完成建立（會產生預設 bucket）。
- [ ] **Bucket 名稱**  
  建立後在專案設定 → 一般 → 你的應用程式裡，`storageBucket` 即為 bucket 名稱（多數為 `專案ID.appspot.com`）。  
  或到 **Storage** 頁面左上/設定裡查看 bucket 名稱。

### 2. Google Cloud Console（同專案）

Firebase 專案對應一個 GCP 專案，服務帳號權限在這裡設定。

- [ ] **開啟 IAM**  
  前往 [Google Cloud Console](https://console.cloud.google.com/) → 選取與 Firebase 相同的專案 → 左側 **IAM 與管理** → **IAM**。
- [ ] **找到服務帳號**  
  在 IAM 成員列表找到「Firebase Admin SDK 的服務帳號」或你下載的金鑰對應的 **client_email**（例如 `firebase-adminsdk-xxxxx@專案ID.iam.gserviceaccount.com`）。
- [ ] **賦予 Storage 寫入權限**  
  該成員至少要有下列其中一種角色：  
  - **Cloud Storage 管理員**（可讀寫、刪除），或  
  - **Storage 物件管理員**（Storage Object Admin），或  
  - **Storage 物件建立者**（Storage Object Creator）＋ **Storage 物件檢視者**（Storage Object Viewer）。  

  若沒有：點該成員右側鉛筆 → **新增其他角色** → 選上述角色 → 儲存。

### 3. Vercel（或你部署的環境）

- [ ] **環境變數已設定**（Settings → Environment Variables），且部署後有 **Redeploy** 一次：  

  | 變數名稱 | 必填 | 說明 |
  |----------|------|------|
  | `FIREBASE_PROJECT_ID` | 是 | 專案 ID（與 Firebase / GCP 一致） |
  | `FIREBASE_CLIENT_EMAIL` | 是 | 服務帳號的 client_email |
  | `FIREBASE_PRIVATE_KEY` | 是 | 服務帳號的 private_key（含 `\n` 整段） |
  | `FIREBASE_STORAGE_BUCKET` 或 `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | 建議 | Storage 的 bucket 名稱（例如 `專案ID.appspot.com`）。未設時後端會用 `{FIREBASE_PROJECT_ID}.appspot.com`。 |

- [ ] **Private Key 格式**  
  `FIREBASE_PRIVATE_KEY` 必須是完整字串，包含 `\n`（在 Vercel 可原樣貼上 JSON 裡的 `private_key` 值，雙引號內含 `\n`）。

### 4. 本機開發（.env.local）

- [ ] 同上表，在 `.env.local` 設定 `FIREBASE_PROJECT_ID`、`FIREBASE_CLIENT_EMAIL`、`FIREBASE_PRIVATE_KEY`。
- [ ] 若有使用前端 Storage（例如週曆播放），需有 `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`（與 Firebase 專案設定的 `storageBucket` 相同）。

---

## 三、常見錯誤對應

| 狀況 | 可能原因 | 建議 |
|------|----------|------|
| 音檔儲存失敗 | Storage 未啟用、bucket 不存在 | Firebase Console → Storage → 開始使用 |
| 音檔儲存失敗 | 403 權限不足 | GCP IAM 為服務帳號加上 Storage 角色（見上） |
| 音檔儲存失敗（404） | bucket 名稱與 API 不符 | 到 **Google Cloud Console** → Storage → 儲存區，從列表「複製」儲存區名稱（一字不差）設為 FIREBASE_STORAGE_BUCKET |
| 音檔儲存失敗 | 環境變數未生效 | Vercel 改完變數後要再 Deploy 一次 |
| 取得回放網址失敗 | 簽章權限或金鑰問題 | 確認同一服務帳號有 Storage 讀取權限，且 FIREBASE_PRIVATE_KEY 正確 |

---

## 四、如何確認 bucket 名稱（404 時必看）

- **後端 API 以 GCP 為準**：請到 **Google Cloud Console** → 左側 **Storage** → **儲存區**，畫面上列出的「儲存區名稱」才是後端要用的值，請**一字不差**複製到 `FIREBASE_STORAGE_BUCKET`。
- Firebase 專案設定裡的 `storageBucket`（如 `xxx.firebasestorage.app`）有時與 GCP 列表顯示不同；若兩者都 404，以 GCP 儲存區列表為準。
- 預設常見：`專案ID.appspot.com` 或 `專案ID.firebasestorage.app`。
