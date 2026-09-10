import { beforeEach, describe, expect, it } from "vitest";
import { defaultTimerSettings, loadTimerSettings, saveTimerSettings } from "./timerSettings";

describe("reusable timer settings", () => {
  beforeEach(() => localStorage.clear());
  it("remembers AMRAP reps and preserves legacy durations with a safe rep default", () => {
    saveTimerSettings({ ...defaultTimerSettings("amrap"), amrapReps: 15 });
    expect(loadTimerSettings("amrap").amrapReps).toBe(15);
    for (const amrapReps of [undefined, null, 0, -1, 201, 2.5, "15"]) {
      localStorage.setItem("spg:timer-settings:v1:amrap", JSON.stringify({ ...defaultTimerSettings("amrap"), durationSeconds: 321, amrapReps }));
      expect(loadTimerSettings("amrap")).toMatchObject({ durationSeconds: 321, amrapReps: 10 });
    }
  });
  it("remembers exact settings independently for each mode", () => {
    saveTimerSettings({ ...defaultTimerSettings("tabata"), workSeconds: 17, rounds: 4 });
    expect(loadTimerSettings("tabata")).toMatchObject({ workSeconds: 17, rounds: 4 });
    expect(loadTimerSettings("emom")).toMatchObject({ intervalSeconds: 60, rounds: 10 });
    expect(loadTimerSettings("amrap").durationSeconds).toBe(600);
  });
  it("ignores corrupted and out-of-range saved settings", () => {
    localStorage.setItem("spg:timer-settings:v1:tabata", "{");
    expect(loadTimerSettings("tabata")).toEqual(defaultTimerSettings("tabata"));
    localStorage.setItem("spg:timer-settings:v1:tabata", JSON.stringify({ ...defaultTimerSettings("tabata"), workSeconds: -10 }));
    expect(loadTimerSettings("tabata").workSeconds).toBe(20);
  });
  it("preserves zero rests and independently configured AMRAP sets", () => {
    const c = { ...defaultTimerSettings("amrap"), restSeconds: 0, amrapSets: [{ durationSeconds: 20, restSeconds: 0 }, { durationSeconds: 40, restSeconds: 120 }] };
    saveTimerSettings(c);
    expect(loadTimerSettings("amrap")).toEqual(c);
    localStorage.setItem("spg:timer-settings:v1:amrap", JSON.stringify({ ...c, amrapSets: [{ durationSeconds: -1, restSeconds: 0 }] }));
    expect(loadTimerSettings("amrap")).toEqual(defaultTimerSettings("amrap"));
  });
});
