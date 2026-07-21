import { describe, expect, it } from "vitest";
import { selectRandomTimerAudioCue, type TimerAudioCue } from "./timerAudioCues";

const cue = (id: string, eventType: TimerAudioCue["event_type"], isActive = true): TimerAudioCue => ({
  id,
  title: id,
  event_type: eventType,
  storage_path: `${id}.m4a`,
  mime_type: "audio/mp4",
  duration_seconds: 3,
  is_active: isActive,
  created_by: "coach",
  created_at: "2026-07-21T00:00:00Z",
  updated_at: "2026-07-21T00:00:00Z",
});

describe("timer audio personalizzati", () => {
  const cues = [
    cue("start-a", "start"),
    cue("start-disabled", "start", false),
    cue("start-b", "start"),
    cue("finish", "finish"),
  ];

  it("sceglie solo audio attivi assegnati all'evento richiesto", () => {
    expect(selectRandomTimerAudioCue(cues, "start", () => 0)?.id).toBe("start-a");
    expect(selectRandomTimerAudioCue(cues, "start", () => 0.99)?.id).toBe("start-b");
  });

  it("non usa audio di altri eventi o disattivati", () => {
    expect(selectRandomTimerAudioCue(cues, "halfway", () => 0)).toBeNull();
    expect(selectRandomTimerAudioCue([cue("off", "finish", false)], "finish", () => 0)).toBeNull();
  });
});
