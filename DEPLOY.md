# Vercel 部署說明

## 推送／開發請用這個資料夾（避免卡住）

- **本 repo 本機路徑**：`C:\Users\jerey\church-verse-recitation-system`（**外層**，有 `.next`、`functions`、`src` 的那一層）
- 用 Cursor 開專案時：**檔案 → 開啟資料夾** 選上述路徑（外層），不要選裡面的 `church-verse-recitation-system`，這樣終端機與 `npm run build` 都會在外層執行。
- 推送、建置、部署都請在這個資料夾執行（`git push`、`npm run build`）。
- **不要**用 `bible-devotion` 底下的 `church-verse-recitation-system`，那是另一份，branch 也不同（master vs main），容易搞混。
- 若目錄裡還有內層同名資料夾，可刪除內層，只保留外層這一份。

---

## 若出現 `routes-manifest.json couldn't be found`

代表 Vercel 在錯誤的路徑找 `.next`，請檢查：

1. **Root Directory 必須為空**  
   本 repo 的根目錄就是專案根目錄，**不要**在 Vercel 設定 Root Directory（留空）。

2. **Build 要成功**  
   到 Deployments → 點該次部署 → Building 的 log 確認有跑 `next build` 且沒有紅字錯誤；若 build 失敗，`.next` 不會產生。

3. **不要從 bible-devotion 匯入並設子目錄**  
   請直接 **Import** 本 repo：`huazhi2407/church-verse-recitation-system`，不要用 bible-devotion 再設 Root Directory。

## 建議設定

- **Framework Preset**：Next.js（自動偵測即可）
- **Root Directory**：留空
- **Build Command**：`npm run build`（或留空用預設）
- **Output Directory**：留空
- **Install Command**：留空

## 環境變數

在 Vercel 專案設定好：

- `NEXT_PUBLIC_FIREBASE_*`（6 個）
- `FIREBASE_PROJECT_ID`、`FIREBASE_CLIENT_EMAIL`、`FIREBASE_PRIVATE_KEY`
