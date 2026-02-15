/** Gemini 建議語音用 16kHz、16-bit PCM，此為預設輸出選項 */
const GEMINI_SPEECH_SAMPLE_RATE = 16000;

export type WebmToWavOptions = {
  /** 輸出取樣率，預設 16000（Gemini 語音建議） */
  sampleRate?: number;
  /** 是否轉為單聲道，預設 true（語音辨識通常用 mono） */
  mono?: boolean;
};

/**
 * 在瀏覽器將 WebM 錄音轉成 WAV（不依賴伺服器 ffmpeg）。
 * 預設 16kHz 單聲道，方便給 Gemini / Speech-to-Text 使用。
 */
export async function webmBlobToWavBlob(
  webmBlob: Blob,
  options: WebmToWavOptions = {}
): Promise<Blob> {
  const { sampleRate = GEMINI_SPEECH_SAMPLE_RATE, mono = true } = options;
  const arrayBuffer = await webmBlob.arrayBuffer();
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioContextClass();
  const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0) as ArrayBuffer);
  const outBuffer = resampleAndMix(decoded, sampleRate, mono);
  const wavBuffer = audioBufferToWav(outBuffer);
  return new Blob([wavBuffer], { type: "audio/wav" });
}

/** 重取樣並可混成單聲道 */
function resampleAndMix(
  buffer: AudioBuffer,
  targetSampleRate: number,
  toMono: boolean
): AudioBuffer {
  const srcRate = buffer.sampleRate;
  const srcChannels = buffer.numberOfChannels;
  const srcLength = buffer.length;
  const outLength = Math.round((srcLength * targetSampleRate) / srcRate);
  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const outBuffer = ctx.createBuffer(toMono ? 1 : srcChannels, outLength, targetSampleRate);
  const outCh0 = outBuffer.getChannelData(0);

  for (let i = 0; i < outLength; i++) {
    const srcIdx = (i * srcRate) / targetSampleRate;
    const idx0 = Math.floor(srcIdx);
    const frac = srcIdx - idx0;
    let s = 0;
    if (toMono) {
      for (let c = 0; c < srcChannels; c++) {
        const ch = buffer.getChannelData(c);
        const v0 = ch[Math.min(idx0, ch.length - 1)];
        const v1 = ch[Math.min(idx0 + 1, ch.length - 1)];
        s += v0 + frac * (v1 - v0);
      }
      s /= srcChannels;
    } else {
      const ch = buffer.getChannelData(0);
      const v0 = ch[Math.min(idx0, ch.length - 1)];
      const v1 = ch[Math.min(idx0 + 1, ch.length - 1)];
      s = v0 + frac * (v1 - v0);
    }
    outCh0[i] = Math.max(-1, Math.min(1, s));
  }
  if (!toMono && srcChannels > 1) {
    for (let c = 1; c < srcChannels; c++) {
      const outCh = outBuffer.getChannelData(c);
      const ch = buffer.getChannelData(c);
      for (let i = 0; i < outLength; i++) {
        const srcIdx = (i * srcRate) / targetSampleRate;
        const idx0 = Math.floor(srcIdx);
        const frac = srcIdx - idx0;
        const v0 = ch[Math.min(idx0, ch.length - 1)];
        const v1 = ch[Math.min(idx0 + 1, ch.length - 1)];
        outCh[i] = Math.max(-1, Math.min(1, v0 + frac * (v1 - v0)));
      }
    }
  }
  return outBuffer;
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLen = buffer.length * blockAlign;
  const headerLen = 44;
  const totalLen = headerLen + dataLen;
  const arrayBuffer = new ArrayBuffer(totalLen);
  const view = new DataView(arrayBuffer);
  let offset = 0;

  function writeStr(str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset++, str.charCodeAt(i));
    }
  }

  writeStr("RIFF");
  view.setUint32(offset, totalLen - 8, true);
  offset += 4;
  writeStr("WAVE");
  writeStr("fmt ");
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, format, true);
  offset += 2;
  view.setUint16(offset, numChannels, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * blockAlign, true);
  offset += 4;
  view.setUint16(offset, blockAlign, true);
  offset += 2;
  view.setUint16(offset, bitDepth, true);
  offset += 2;
  writeStr("data");
  view.setUint32(offset, dataLen, true);
  offset += 4;

  const left = buffer.getChannelData(0);
  const right = numChannels > 1 ? buffer.getChannelData(1) : left;
  for (let i = 0; i < buffer.length; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true);
    offset += 2;
    if (numChannels > 1) {
      const r = Math.max(-1, Math.min(1, right[i]));
      view.setInt16(offset, r < 0 ? r * 0x8000 : r * 0x7fff, true);
      offset += 2;
    }
  }
  return arrayBuffer;
}
