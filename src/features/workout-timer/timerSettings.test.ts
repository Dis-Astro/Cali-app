import { beforeEach, describe, expect, it } from "vitest";
import { defaultTimerSettings, loadTimerSettings, saveTimerSettings } from "./timerSettings";

describe("reusable timer settings", () => {
  beforeEach(() => localStorage.clear());
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
});
