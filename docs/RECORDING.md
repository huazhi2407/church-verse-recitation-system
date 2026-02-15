# 錄音功能整理

## 一、錄音流程總覽

```
[開始錄音] → MediaRecorder 錄製 (WebM) → [結束錄音]
  → 直接上傳 WebM 到後端 POST /api/verify-recitation-from-audio (multipart)
  → 後端：
      1. 存原始 WebM 到 Storage（只存一份）
      2. 轉 16kHz mono（僅供辨識，不存）
      3. Google Speech-to-Text 辨識
      4. 計算準確率
  → 回傳：{ audioUrl, transcript, pass, accuracy }
  → 前端顯示結果 + 提供回放
```

---

## 二、前端（Dashboard）

### 2.1 錄音來源

| 方式 | 說明 |
|------|------|
| **即時錄音** | 點「開始錄音」→ 用麥克風錄製 → 「結束錄音」後自動上傳 WebM 到後端並顯示辨識結果與回放 |
| **上傳檔案** | 選擇音檔 → 以 multipart 上傳到同一 API → 後端存檔、辨識、回傳結果與音檔 URL |
| **貼上網址** | 輸入已存在的錄音 URL → 以 JSON 呼叫驗證 API（不另上傳） |

### 2.2 即時錄音時發生的事

1. **取得麥克風**：`navigator.mediaDevices.getUserMedia({ audio: true })`
2. **選擇格式**：`getPreferredAudioMimeType()` 優先 WebM（`audio/webm; codecs=opus` / `audio/webm`），以便直接上傳後端
3. **錄音**：`MediaRecorder` 收集 `ondataavailable` 的 chunks
4. **同時（可選）**：若瀏覽器支援 `SpeechRecognition`，會即時辨識並填入「背誦內容」文字（供手動驗證或顯示）

### 2.3 結束錄音後（`mr.onstop`）

1. **Blob**：`new Blob(chunks, { type: blobMime })`（以 WebM 為主）
2. **上傳**：`uploadAudioAndVerify(blob)` → `FormData` 附上 `file`、`weekId`、`day`、`testFirstVerseOnly`、`testFirstSixSegments`，POST 到 `/api/verify-recitation-from-audio`（不經 Firebase Storage、不轉 WAV/MP3）
3. **顯示**：依回傳的 `audioUrl`、`transcript`、`pass`、`accuracy` 顯示結果，並用 `<audio src={audioUrl} controls />` 提供回放

### 2.4 用音檔驗證（選擇檔案 / 貼上網址）

- **選擇音檔**：`uploadAudioAndVerify(audioFile)`，同上 multipart 上傳，後端存檔並辨識。
- **貼上網址**：`verifyFromAudioUrl(url)`，POST JSON `{ weekId, day, audioUrl, ... }`，後端下載後辨識（不存檔），回傳結果與同一 `audioUrl` 供回放。

### 2.5 驗證選項（錄音／上傳／網址都共用）

- **僅驗證第一節**：只比對本週經文第 1 段
- **測試六節**：只比對本週前 6 段累加；勾選時會顯示「本週前六天經文（驗證範圍）」

---

## 三、後端 API：`/api/verify-recitation-from-audio`

### 3.1 輸入

**Multipart（上傳音檔）**

- `file`：WebM（或支援格式）音檔
- `weekId`、`day`（1–7）、`testFirstVerseOnly`、`testFirstSixSegments`

**JSON（貼上網址）**

- `weekId`、`day`、`audioUrl`、`testFirstVerseOnly?`、`testFirstSixSegments?`

### 3.2 流程

**Multipart**

1. 存原始 WebM 到 Storage：`recordings/{userId}/{weekId}/rec-{timestamp}.webm`（只存 webm）
2. 取得 signed URL 作為回傳的 `audioUrl`
3. 辨識：webm → ffmpeg → 16kHz mono buffer → STT；若 ffmpeg 不可用（如 Vercel）則改以 WEBM_OPUS 直接送 STT
5. `verifyRecitation(...)` 計算準確率
6. 回傳：`{ audioUrl, transcript, pass, accuracy }`

**JSON**

1. `fetch(audioUrl)` 下載音檔，限制 10MB
2. 若為 WebM：ffmpeg 轉 16kHz mono buffer 後辨識；否則依 `detectAudioConfig`（MP3/FLAC/OGG_OPUS）直接辨識
3. 驗證、回傳同上（`audioUrl` 為請求中的網址）

### 3.3 依賴

- Firebase Admin（auth、firestore、storage）
- `@google-cloud/speech`、`ffmpeg-static` + `fluent-ffmpeg`（WebM → 16kHz mono buffer，僅供辨識）
- `src/lib/convertWebmToLinear16.ts`

---

## 四、儲存與轉檔

| 項目 | 說明 |
|------|------|
| Storage | 僅存一份原始 WebM：`recordings/{uid}/{weekId}/rec-{ts}.webm`（僅 multipart 上傳時寫入） |
| 辨識 | WebM 經 ffmpeg 轉成 16kHz mono buffer（不存檔）→ Speech-to-Text LINEAR16 |
| 回放 | 前端使用 API 回傳的 `audioUrl`（signed URL 或貼上的網址） |

---

## 五、相關檔案

| 檔案 | 用途 |
|------|------|
| `src/app/dashboard/page.tsx` | 錄音 UI、上傳 WebM、顯示辨識結果與回放 |
| `src/app/api/verify-recitation-from-audio/route.ts` | 存 WebM、ffmpeg→wav buffer、Speech-to-Text、驗證、回傳 audioUrl + transcript + pass + accuracy |
| `src/lib/convertWebmToLinear16.ts` | 後端：WebM → 16kHz mono PCM buffer（僅供辨識，不存檔） |
| `src/lib/verifyRecitationLogic.ts` | 辨識結果正規化、拼音比對、通過/準確度 |

---

## 六、注意事項

- **即時辨識**：`SpeechRecognition` 僅部分瀏覽器支援，沒有時不會報錯，只是不會自動帶入文字。
- **回放**：`audioUrl` 若為 signed URL 有時效；長期回放可依需求改為公開讀取或縮短過期時間。
- **格式**：multipart 建議上傳 WebM；貼上網址支援 WebM / MP3 / FLAC / OGG（由後端偵測）。
