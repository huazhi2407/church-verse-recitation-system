# 音檔 AI 偵測（Speech-to-Text）設定

「存入的音檔直接給 AI 偵測」使用 **Google Cloud Speech-to-Text**，與 Firebase 同一 GCP 專案即可。

## 1. 啟用 API

1. 開啟 [Google Cloud Console](https://console.cloud.google.com/)
2. 選擇與 Firebase 相同的專案
3. 搜尋 **Speech-to-Text API** → 啟用

## 2. 憑證

使用與 Firebase Admin 相同的服務帳戶即可（`FIREBASE_PROJECT_ID`、`FIREBASE_CLIENT_EMAIL`、`FIREBASE_PRIVATE_KEY`），無需額外環境變數。

## 3. 音檔格式

- 建議：**WebM（Opus）**，瀏覽器 `MediaRecorder` 預設錄製格式
- 取樣率：48000 Hz
- 若上傳其他格式，可能需在 API 中調整 `encoding` 與 `sampleRateHertz`

## 4. API 用法

- **路徑**：`POST /api/verify-recitation-from-audio`
- **Body**：`{ weekId, day, audioUrl, testFirstVerseOnly? }`
- **audioUrl**：Firebase Storage 的 `getDownloadURL()` 網址
- **回傳**：`{ pass, accuracy, transcript }`（與文字驗證相同，多一個辨識結果 `transcript`）
