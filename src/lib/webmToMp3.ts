/**
 * 在瀏覽器將 WebM/MP4 錄音轉成 MP3（使用 lamejs），不依賴伺服器。
 */
import lamejs from "lamejs";

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

  const encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
  const mp3Chunks: BlobPart[] = [];

  for (let i = 0; i + MP3_CHUNK <= samples.length; i += MP3_CHUNK) {
    const chunk = samples.subarray(i, i + MP3_CHUNK);
    const buf = encoder.encodeBuffer(chunk);
    if (buf.length > 0) mp3Chunks.push((buf instanceof Int8Array ? buf : new Int8Array(buf)) as BlobPart);
  }
  const flush = encoder.flush();
  if (flush.length > 0) mp3Chunks.push((flush instanceof Int8Array ? flush : new Int8Array(flush)) as BlobPart);

  return new Blob(mp3Chunks, { type: "audio/mp3" });
}
