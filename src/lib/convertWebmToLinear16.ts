/**
 * 將 WebM 轉成 16kHz 單聲道 raw PCM (s16le)，僅供 Speech-to-Text 辨識用，不存檔。
 */
import { PassThrough } from "stream";
import ffmpeg from "fluent-ffmpeg";

try {
  const ffmpegPath = require("ffmpeg-static") as string | undefined;
  if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
} catch {
  // 使用系統 ffmpeg
}

export function convertWebmToLinear16(inputBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const inputStream = new PassThrough();
    inputStream.end(inputBuffer);

    const outStream = ffmpeg(inputStream)
      .inputFormat("webm")
      .audioCodec("pcm_s16le")
      .audioFrequency(16000)
      .audioChannels(1)
      .format("s16le")
      .on("error", reject)
      .pipe() as NodeJS.ReadableStream;

    outStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    outStream.on("end", () => resolve(Buffer.concat(chunks)));
    outStream.on("error", reject);
  });
}
