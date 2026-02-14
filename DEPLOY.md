# Vercel 部署說明

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
