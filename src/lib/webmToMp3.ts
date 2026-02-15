/**
 * 在瀏覽器將 WebM/MP4 錄音轉成 MP3（使用 lamejs），不依賴伺服器。
 */
const MP3_CHUNK = 1152;

export async function audioBlobToMp3Blob(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioContextClass();
  const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0) as ArrayBuffer);

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

  const lamejs = await import("lamejs");
  const lib = (lamejs as { default?: { Mp3Encoder: unknown }; Mp3Encoder?: unknown }).default ?? lamejs;
  const Mp3Encoder = (lib as { Mp3Encoder: new (ch: number, sr: number, kb: number) => { encodeBuffer: (s: Int16Array) => number[]; flush: () => number[] } }).Mp3Encoder;
  const encoder = new Mp3Encoder(1, sampleRate, 128);
  const mp3Chunks: Int8Array[] = [];

  for (let i = 0; i < samples.length; i += MP3_CHUNK) {
    const chunk = samples.subarray(i, Math.min(i + MP3_CHUNK, samples.length));
    const buf = encoder.encodeBuffer(chunk);
    if (buf.length > 0) mp3Chunks.push(new Int8Array(buf));
  }
  const flush = encoder.flush();
  if (flush.length > 0) mp3Chunks.push(new Int8Array(flush));

  return new Blob(mp3Chunks as BlobPart[], { type: "audio/mp3" });
}
