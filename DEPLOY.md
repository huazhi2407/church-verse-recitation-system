# 部署說明 (bible-devotion → production)

若出現「There was an error deploying bible-devotion to the production environment」，多半是因為 **要部署的應用在子目錄**，平台卻從 repo 根目錄建置。

---

## 方法 A：從 repo 根目錄建置（推薦，免改 Root Directory）

在部署平台維持 **Root Directory = 根目錄**，只改建置／啟動指令：

- **Build command**：`npm run build:deploy`
- **Start command**（若為 Node 伺服器）：`npm run start:deploy`

根目錄的 `package.json` 已提供這兩個 script，會自動在 `church-verse-recitation-system` 裡安裝依賴並建置。

---

## 方法 B：指定正確的根目錄

若你偏好從子目錄建置，請在部署平台專案設定裡把 **Root Directory / 建置目錄 / Build context** 設成：

```text
church-verse-recitation-system
```

- **Vercel**：Project Settings → General → Root Directory → 填 `church-verse-recitation-system` → Save  
- **Netlify**：Site settings → Build & deploy → Base directory → 填 `church-verse-recitation-system`  
- **K8s / 自建 CI**：在 clone 後 `cd church-verse-recitation-system` 再執行 `npm install` 與 `npm run build`

不要用 repo 根目錄建置，否則會建到上層的 `bible-devotion` 專案而不是本應用。

## 2. 建置與啟動指令

- **Build command**：`npm run build`  
- **Output**：Next.js 預設（無需特別設 Static directory）  
- **Start**（若為 Node 伺服器）：`npm run start`，port 預設 3001  

若平台會自動偵測 Next.js，通常只要設對 Root Directory 即可。

## 3. 環境變數

在部署專案中設定：

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`（整段 JSON 金鑰中的 private_key，換行可保留 `\n`）

建置時若未設定上述變數，build 仍可通過，但上線後登入與 Firestore 會無法使用。

## 4. 若仍失敗

請到部署平台的 **Deployment details / 建置日誌** 中，複製**完整錯誤訊息**（例如 `Error: ...` 或 build failed 的那幾行），再依錯誤內容排查或提供給支援方。
