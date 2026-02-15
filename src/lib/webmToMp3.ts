/**
 * 在瀏覽器將 WebM/MP4 錄音轉成 MP3（使用 lamejs），不依賴伺服器。
 * 改從 CDN 載入預打包的 lame.min.js，避免 Next 打包 CommonJS 時 MPEGMode 未定義。
 */
const LAMEJS_CDN = "https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js";

declare global {
  interface Window {
    lamejs?: { Mp3Encoder: new (ch: number, sr: number, kbps: number) => { encodeBuffer: (s: Int16Array) => Int8Array; flush: () => Int8Array } };
  }
}

function loadLamejs(): Promise<NonNullable<Window["lamejs"]>> {
  if (typeof window === "undefined") return Promise.reject(new Error("lamejs only in browser"));
  if (window.lamejs?.Mp3Encoder) return Promise.resolve(window.lamejs);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = LAMEJS_CDN;
    script.async = true;
    script.onload = () => {
      if (window.lamejs?.Mp3Encoder) resolve(window.lamejs);
      else reject(new Error("lamejs failed to load"));
    };
    script.onerror = () => reject(new Error("lamejs script load failed"));
    document.head.appendChild(script);
  });
}

const MP3_CHUNK = 1152;

export async function audioBlobToMp3Blob(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const copy = arrayBuffer.slice(0);
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioContextClass();
  const decoded = await ctx.decodeAudioData(copy as ArrayBuffer);

  const channels = decoded.numberOfChannels;
  const sampleRate = decoded.sampleRate;
  const left = decoded.getChannelData(0);
  const right = channels > 1 ? decoded.getChannelData(1) : left;
  const len = decoded.length;
  const samples = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    const s = channels > 1 ? (left[i] + right[i]) / 2 : left[i];
    const v = Math.max(-1, Math.min(1, s));
    samples[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }

  const lamejs = await loadLamejs();
  const encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
  const mp3Chunks: BlobPart[] = [];

  for (let i = 0; i + MP3_CHUNK <= samples.length; i += MP3_CHUNK) {
    const chunk = samples.subarray(i, i + MP3_CHUNK);
    const buf = encoder.encodeBuffer(chunk);
    if (buf.length > 0) mp3Chunks.push(buf as BlobPart);
  }
  const flush = encoder.flush();
  if (flush.length > 0) mp3Chunks.push(flush as BlobPart);

  return new Blob(mp3Chunks, { type: "audio/mp3" });
}
