# 教會經文背誦系統 — 新 Firebase 專案設定

本專案使用**獨立 Firebase 專案**時，請依下列步驟操作。

---

## 1. 建立新 Firebase 專案

1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 點擊「新增專案」
3. 輸入專案名稱（例如：`church-verse-recitation`）
4. 是否啟用 Google Analytics 可自選
5. 點擊「建立專案」

---

## 2. 啟用 Authentication

1. 左側選單 → **Authentication** → 「開始使用」
2. 本系統使用 **Custom Token** 登入（由後端 API 發放），不需開啟 Google/Email 等登入方式
3. 只要專案有啟用 Authentication 即可

---

## 3. 建立 Firestore 資料庫

1. 左側選單 → **Firestore Database** → 「建立資料庫」
2. 選擇「以**測試模式**啟動」（之後會用規則檔覆蓋）
3. 選擇位置（例如：`asia-east1` 台灣）→ 啟用

---

## 4. 取得前端設定（NEXT_PUBLIC_*）

1. 專案首頁 → ⚙️ **專案設定**
2. 捲到「你的應用程式」→ 點 **Web** 圖示 `</>`
3. 應用程式暱稱（例如：`Church Verse Web`）→ 註冊
4. 複製 `firebaseConfig` 裡的欄位，對應到 `.env.local`：

| firebaseConfig     | .env.local |
|--------------------|------------|
| apiKey             | NEXT_PUBLIC_FIREBASE_API_KEY |
| authDomain         | NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN |
| projectId          | NEXT_PUBLIC_FIREBASE_PROJECT_ID |
| storageBucket      | NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET |
| messagingSenderId  | NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID |
| appId              | NEXT_PUBLIC_FIREBASE_APP_ID |

---

## 5. 取得後端金鑰（服務帳戶）

1. 專案設定 → 「服務帳戶」分頁
2. 點「產生新的私密金鑰」→ 確認
3. 下載的 JSON 檔中會有三個值：

| JSON 欄位 | .env.local |
|-----------|------------|
| `project_id` | FIREBASE_PROJECT_ID |
| `client_email` | FIREBASE_CLIENT_EMAIL |
| `private_key` | FIREBASE_PRIVATE_KEY |

**FIREBASE_PRIVATE_KEY 填寫注意：**  
`private_key` 是整段含 `\n` 的字串，請**原樣貼上**（含雙引號內的反斜線），例如：

```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

---

## 6. 填寫專案內的 .env.local

在專案根目錄（與 `package.json` 同層）：

```bash
# Windows
copy .env.local.example .env.local

# 或用 PowerShell
Copy-Item .env.local.example .env.local
```

然後用編輯器打開 `.env.local`，把步驟 4、5 的值全部貼上並存檔。

---

## 7. 部署 Firestore 規則

本專案使用自己的 `firestore.rules`，需部署到**這個新 Firebase 專案**。

### 7.1 在專案目錄初始化 Firebase（若尚未）

```bash
cd church-verse-recitation-system   # 或你的專案目錄
npm install -g firebase-tools       # 若尚未安裝
firebase login
firebase init
```

- 選 **Firestore**（用空白鍵勾選）
- 若問「What file should be used for Firestore Rules?」→ 填 `firestore.rules`（或直接 Enter 用預設，再把本專案的 `firestore.rules` 內容覆蓋進去）
- 若問「What file should be used for Firestore indexes?」→ 可直接 Enter

### 7.2 連結到新專案並部署

```bash
firebase use --add
```

選你剛建立的專案（例如 `church-verse-recitation`），別名可用 `default`。

```bash
firebase deploy --only firestore:rules
```

出現「Rules file firestore.rules compiled successfully」即完成。

---

## 8. 設定第一位管理員

Firestore 建立好且規則部署後：

1. 用本系統**註冊一個帳號**（名字 + 密碼），取得帳號編號（如 0001）
2. 到 Firebase Console → **Firestore Database** → 找到 `users` 集合 → 點開該帳號文件（如 `0001`）
3. 把欄位 **`role`** 從 `member` 改為 **`admin`**
4. 該帳號重新登入後即可使用「管理經文」與查看所有人的過曆表格

---

## 檢查清單

- [ ] 新 Firebase 專案已建立
- [ ] Authentication 已啟用
- [ ] Firestore 已建立（測試模式可，之後用規則覆蓋）
- [ ] `.env.local` 已填好所有 NEXT_PUBLIC_* 與 FIREBASE_*
- [ ] `firebase use` 已選到新專案
- [ ] `firebase deploy --only firestore:rules` 已成功
- [ ] 已至少註冊一組帳號並將一位設為 admin

完成後在專案執行 `npm run dev`，即可用新 Firebase 專案運作。
