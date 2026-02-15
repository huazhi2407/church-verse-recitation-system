declare module "lamejs" {
  export interface Mp3EncoderInstance {
    encodeBuffer(samples: Int16Array): number[];
    flush(): number[];
  }
  export const Mp3Encoder: new (
    channels: number,
    sampleRate: number,
    kbps: number
  ) => Mp3EncoderInstance;
  export const WavHeader: { readHeader(view: DataView): { dataOffset: number; dataLen: number; channels: number; sampleRate: number } };
}
