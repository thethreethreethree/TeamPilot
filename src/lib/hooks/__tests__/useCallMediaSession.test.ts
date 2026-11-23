// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { mediaActions, SKIP_SECONDS } from "../useCallMediaSession";

/** Listen in the car (F30.8): the lock-screen / car controls drive the player; seeking stays inside the recording. */
const fakeAudio = (currentTime: number, duration: number) => {
  const el = { currentTime, duration, paused: true, play: async () => { el.paused = false; }, pause: () => { el.paused = true; } };
  return el as unknown as HTMLAudioElement & { paused: boolean };
};

describe("mediaActions", () => {
  it("back/forward 15 seconds, clamped to the recording; seekto; play and pause", async () => {
    const el = fakeAudio(10, 100);
    const a = mediaActions(el);
    a.seekbackward!({ action: "seekbackward" });
    expect(el.currentTime).toBe(0); // 10 − 15, not below 0
    a.seekforward!({ action: "seekforward" });
    expect(el.currentTime).toBe(SKIP_SECONDS);
    a.seekto!({ action: "seekto", seekTime: 500 });
    expect(el.currentTime).toBe(100); // not past the end
    a.play!({ action: "play" });
    await Promise.resolve();
    expect(el.paused).toBe(false);
    a.pause!({ action: "pause" });
    expect(el.paused).toBe(true);
  });
});
