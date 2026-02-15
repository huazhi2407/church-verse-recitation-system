import { PassThrough } from "stream";
import ffmpeg from "fluent-ffmpeg";

/** 將 WebM/Opus 轉成 FLAC，供 Speech-to-Text / Gemini 等 API 使用 */
export function convertWebmToFlac(inputBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const inputStream = new PassThrough();
    inputStream.end(inputBuffer);

    try {
      const ffmpegPath = require("ffmpeg-static") as string | undefined;
      if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
    } catch {
      // 未安裝 ffmpeg-static 時使用系統 ffmpeg
    }

    const cmd = ffmpeg(inputStream)
      .inputFormat("webm")
      .audioCodec("flac")
      .format("flac")
      .audioFrequency(16000)
      .on("error", (err: Error) => reject(err));

    const outStream = cmd.pipe() as NodeJS.ReadableStream & { on(event: "data", fn: (c: Buffer) => void): void; on(event: "end", fn: () => void): void };
    outStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    outStream.on("end", () => resolve(Buffer.concat(chunks)));
    outStream.on("error", reject);
  });
}
