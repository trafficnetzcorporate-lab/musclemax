import { registerPlugin } from '@capacitor/core';
import { isNative } from './platform';

/**
 * Native bridge definitions for Muscle Max.
 *
 * The matching Swift implementation lives in `native-plugins/emom-native` and is
 * copied into the Xcode project by `npx cap sync`. On the web these calls are
 * never made — every helper here is guarded by isNative() at the call site.
 */

export type EmomCueKind = 'soft' | 'hard' | 'end';

export interface EmomNativePlugin {
  /** Native monotonic clock (ProcessInfo.systemUptime) — immune to clock changes. */
  monotonicNow(): Promise<{ seconds: number }>;
  /** UIApplication.isIdleTimerDisabled — keep the screen awake during a workout. */
  setKeepAwake(options: { enabled: boolean }): Promise<void>;
  /**
   * Play one EMOM cue natively: activate AVAudioSession with .duckOthers, play
   * the bundled cue, then deactivate with .notifyOthersOnDeactivation so the
   * user's music returns to full volume. Ducking lasts only for the cue.
   */
  playEmomCue(options: { kind: EmomCueKind }): Promise<void>;
}

export const EmomNative = registerPlugin<EmomNativePlugin>('EmomNative');

/** Fire-and-forget native cue; silently ignored on web or if the cue fails. */
export function playNativeCue(kind: EmomCueKind): void {
  if (!isNative()) return;
  EmomNative.playEmomCue({ kind }).catch(() => { /* native layer handles fallback */ });
}

/** Keep the screen awake on native. */
export async function setNativeKeepAwake(enabled: boolean): Promise<void> {
  if (!isNative()) return;
  try { await EmomNative.setKeepAwake({ enabled }); } catch { /* noop */ }
}

/**
 * Seconds on the native monotonic clock, or null on web. Callers align it with
 * Date.now() once and reuse the offset so timer reads stay synchronous.
 */
export async function nativeMonotonicSeconds(): Promise<number | null> {
  if (!isNative()) return null;
  try {
    const { seconds } = await EmomNative.monotonicNow();
    return seconds;
  } catch {
    return null;
  }
}
