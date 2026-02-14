# 教會經文背誦系統 (church-verse-recitation-system)

Next.js + Firebase 建置的背經文工具：註冊／登入（帳號編號＋密碼）、管理員填寫**一週經文**（每天累加）、**錄音 + AI 感測簽到**、**過曆表格**進度追蹤。

## 功能

- **登入系統**：名字 + 密碼註冊，系統自動給予帳號編號（0001、0002…）；登入時使用編號 + 密碼。
- **主要功能（管理員）**
  - 填寫**一週經文**：選擇週一日期、經文出處，並填入第 1～7 天「當天新增」的段落（每天經文為累加：第 1 天一段、第 2 天 1+2 段…）。
  - **刪除**該週經文。
- **使用者**
  - 首頁顯示**本週、當天**的累加經文。
  - **錄音背誦**後，可手動輸入或依瀏覽器語音辨識帶入內容，按「驗證背誦」由系統比對經文；**驗證通過才可簽到**。
- **過曆表格**
  - 列出七天（週一～週日），可**左右切換週**。
  - 每個帳號：**已簽到＝綠**、**未完成＝紅**、**未到／未來＝灰**。
  - 一般使用者只看自己的那一列；管理員可看所有帳號的進度。

## 環境設定

1. 複製環境變數範例並填入 Firebase 設定：

   ```bash
   cp .env.local.example .env.local
   ```

2. **Firebase 專案**（可與現有專案共用或新建）：
   - 啟用 **Authentication**（用於 Custom Token 登入）。
   - 啟用 **Firestore**。
   - 在 `.env.local` 填入：
     - `NEXT_PUBLIC_*`：來自 Firebase 主控台「專案設定」的 Web 應用程式設定。
     - `FIREBASE_PROJECT_ID`、`FIREBASE_CLIENT_EMAIL`、`FIREBASE_PRIVATE_KEY`：來自「服務帳戶」金鑰（用於後端登入／註冊 API 與 Custom Token）。

3. 部署 Firestore 規則：

   ```bash
   firebase deploy --only firestore:rules
   ```

   若尚未設定 Firebase CLI，請先於專案目錄執行 `firebase init` 並選擇 Firestore，再將本專案中的 `firestore.rules` 覆蓋或合併至預設規則。

## 設定第一位管理員

系統不會自動建立管理員。請在 Firebase 主控台 → Firestore → `users` 集合中，找到要設為管理員的帳號編號文件（例如 `0001`），將欄位 `role` 從 `member` 改為 `admin`。之後該帳號登入即可使用「管理經文」與查看所有人的過曆表格。

## 資料結構（Firestore）

- **users** / **counters**：同前（註冊與帳號編號）。
- **weeklyVerses/{weekId}**：`weekId` 為週一日期 `YYYY-MM-DD`。欄位：`reference`、`segments`（長度 7 的陣列，第 n 個為「第 n 天新增」的段落）、`updatedAt`、`updatedBy`。
- **checkins/{userId}/weeks/{weekId}**：該使用者在該週的簽到。欄位：`day1`～`day7`（Timestamp 或無），表示該天已簽到。

## 開發

```bash
npm install
npm run dev
```

預設為 <http://localhost:3001>（與主專案 3000 錯開）。

## 建置與上線

```bash
npm run build
npm run start
```

**部署注意（K8s / CI）**：請在 **`church-verse-recitation-system` 目錄內**執行 `npm run build`（不要從 repo 根目錄建置根專案）。建置時若未設定 `NEXT_PUBLIC_FIREBASE_*` 等環境變數，build 仍會完成，但上線後需在執行環境提供這些變數，前端登入與 Firestore 才會正常。

---

本專案位於 `bible-devotion` 倉庫下的 `church-verse-recitation-system` 目錄。
