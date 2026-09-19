export type EmomCueKind = 'soft' | 'hard' | 'end';

export interface EmomNativePlugin {
  monotonicNow(): Promise<{ seconds: number }>;
  setKeepAwake(options: { enabled: boolean }): Promise<void>;
  playEmomCue(options: { kind: EmomCueKind }): Promise<void>;
}

export declare const EmomNative: EmomNativePlugin;
