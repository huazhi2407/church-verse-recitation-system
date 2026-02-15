# 測試建議

## 一、手動測試（建議每次上線前跑一輪）

### 1. 錄音 + 驗證流程（本機或 Vercel）

| 步驟 | 操作 | 預期 |
|------|------|------|
| 1 | 登入 → 選擇「僅驗證第一節」 | 勾選成功，顯示第一段經文 |
| 2 | 點「開始錄音」 | 取得麥克風、顯示「錄音中」 |
| 3 | 唸出第一段經文（或故意唸錯/唸少） | 可選即時辨識文字 |
| 4 | 點「結束錄音」 | 顯示「上傳中」→「AI 偵測中」 |
| 5 | 等待結果 | 顯示準確度、辨識結果、通過/未通過、回放按鈕 |
| 6 | 點回放 | 能播放剛錄的 webm（signed URL） |
| 7 | 準確度 ≥90% 時點「確認簽到」 | 簽到成功、顯示「今日已簽到」 |

### 2. 用音檔驗證（上傳檔案）

| 步驟 | 操作 | 預期 |
|------|------|------|
| 1 | 選擇一個 WebM/MP3 音檔 → 點「用音檔驗證」 | 上傳並辨識，顯示結果與回放 |

### 3. 用音檔驗證（貼上網址）

| 步驟 | 操作 | 預期 |
|------|------|------|
| 1 | 貼上已存在的錄音 URL（如 Storage 的 signed URL）→ 點「用音檔驗證」 | 下載並辨識，顯示結果與回放 |

### 4. 驗證邏輯邊界

- **測試六節**：勾選後應顯示「本週前六天經文」，驗證時只比對前六段。
- **未登入**：訪問 dashboard 應導向登入頁。
- **本週無經文**：顯示「本週尚未填寫經文」，錄音區仍可操作（僅驗證第一節時可測）。

---

## 二、單元測試（驗證邏輯）

專案內有對 `verifyRecitationLogic` 的單元測試，確保拼音比對、準確度、通過門檻正確。

```bash
npm run test
```

- 位置：`src/lib/verifyRecitationLogic.test.ts`
- 內容：預期經文 vs 辨識結果（含全形半形、標點、空格、章節編號）的通過/準確度。

---

## 三、API 快速測試（可選）

有 Firebase 登入 token 時，可用 curl 測 API（將 `YOUR_ID_TOKEN`、`weekId`、`day` 換成實際值）：

```bash
# 貼上網址（JSON）
curl -X POST "https://church-verse-recitation-system.vercel.app/api/verify-recitation-from-audio" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"weekId\":\"2025-02-10\",\"day\":1,\"audioUrl\":\"https://...\"}"
```

上傳 WebM 檔（multipart）：

```bash
curl -X POST "https://church-verse-recitation-system.vercel.app/api/verify-recitation-from-audio" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -F "file=@rec.webm" \
  -F "weekId=2025-02-10" \
  -F "day=1" \
  -F "testFirstVerseOnly=true" \
  -F "testFirstSixSegments=false"
```

預期回傳：`{ "audioUrl", "transcript", "pass", "accuracy" }` 或 4xx/5xx + `error`。

---

## 四、Vercel 部署後必測

1. **錄音 → 結束 → 上傳**：確認不會 500（無 ffmpeg 時會走 WEBM_OPUS 辨識）。
2. **回放**：signed URL 可播放、無 CORS 問題。
3. **簽到**：通過後簽到會寫入 Firestore，過曆表格會更新。

---

## 五、取得 ID Token（用於 curl）

- 瀏覽器：登入後在 Console 執行  
  `(await firebase.auth().currentUser.getIdToken()).then(t => console.log(t))`  
  （若專案有暴露 `auth` 或 Firebase 實例）
- 或從 Application → Local Storage 找 Firebase 相關 key（視專案設定而定）。
