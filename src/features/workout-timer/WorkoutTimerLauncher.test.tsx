import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StrictMode, useState } from "react";
import WorkoutTimerLauncher, { TimerConfiguration, WorkoutTimerScreen } from "./WorkoutTimerLauncher";
import { DEFAULT_TIMER_CONFIG } from "./types";

const audio = vi.hoisted(() => ({ play: vi.fn(async () => false), prime: vi.fn(async () => undefined), stop: vi.fn() }));
vi.mock("./timerAudioCues", () => ({ useTimerAudioCues: () => audio }));
vi.mock("./timerFeedback", () => ({ playTimerTone: vi.fn(), speakTimerMessage: vi.fn(), unlockTimerAudio: vi.fn(async () => undefined) }));
vi.mock("@/components/coaching/ExerciseVideoRecorder", () => ({ default: () => null }));

afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear(); vi.restoreAllMocks(); });
describe("simplified timer setup", () => {
  it("offers four workout modes and keeps recovery countdown available", () => {
    render(<WorkoutTimerLauncher exerciseName="Squat" />);
    fireEvent.click(screen.getByRole("button", { name: "Apri timer per Squat" }));
    for (const mode of ["AMRAP", "FOR TIME", "EMOM", "Tabata", "Countdown"]) {
      expect(screen.getByRole("button", { name: new RegExp(mode) })).toBeVisible();
    }
    fireEvent.click(screen.getByRole("button", { name: /Tabata/ }));
    expect(screen.getByRole("button", { name: /Avvia · 10 secondi/ })).toBeVisible();
    expect(screen.getByText("Lavoro")).toBeVisible();
    expect(screen.getByText("Recupero")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Cambia modalità/ }));
    expect(screen.getByRole("button", { name: /AMRAP/ })).toBeVisible();
  });

  it("supports exact seconds without rounding to ten or opening a keyboard", () => {
    function Config() {
      const [config, setConfig] = useState({ ...DEFAULT_TIMER_CONFIG, durationSeconds: 75 });
      return <><TimerConfiguration config={config} onChange={setConfig} /><output>{config.durationSeconds}</output></>;
    }
    render(<Config />);
    const seconds = screen.getByRole("combobox", { name: "Secondi" });
    expect(seconds).toHaveValue("15");
    fireEvent.change(seconds, { target: { value: "17" } });
    expect(screen.getByRole("status")).toHaveTextContent("77");
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("starts once after preparation, even with React StrictMode", async () => {
    vi.useFakeTimers();
    render(<StrictMode><WorkoutTimerScreen config={DEFAULT_TIMER_CONFIG} onClose={vi.fn()} /></StrictMode>);
    await act(async () => {});
    expect(screen.getByTestId("timer-display")).toHaveTextContent("10");
    await act(async () => { vi.advanceTimersByTime(10_000); });
    expect(screen.getByRole("button", { name: "Pausa" })).toBeVisible();
    expect(screen.getByTestId("timer-display")).toHaveTextContent("01:30");
    await act(async () => { vi.advanceTimersByTime(2_000); });
    fireEvent.click(screen.getByRole("button", { name: "Pausa" }));
    await act(async () => { vi.advanceTimersByTime(5_000); });
    expect(screen.getByTestId("timer-display")).toHaveTextContent("01:28");
    fireEvent.click(screen.getByRole("button", { name: "Riprendi" }));
    await act(async () => { vi.advanceTimersByTime(1_000); });
    expect(screen.getByTestId("timer-display")).toHaveTextContent("01:27");
  });

  it("opens the exercise evaluation exactly once after finishing", async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const onClose = vi.fn();
    render(<WorkoutTimerScreen config={{ ...DEFAULT_TIMER_CONFIG, durationSeconds: 2 }} onClose={onClose} onComplete={onComplete} />);
    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(10_000); });
    await act(async () => { vi.advanceTimersByTime(2_000); });
    await act(async () => { vi.advanceTimersByTime(1_400); });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("does not restart after cancelling preparation", async () => {
    vi.useFakeTimers();
    render(<WorkoutTimerScreen config={DEFAULT_TIMER_CONFIG} onClose={vi.fn()} />);
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "Annulla partenza" }));
    await act(async () => { vi.advanceTimersByTime(20_000); });
    expect(screen.getByRole("button", { name: "Avvia" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Pausa" })).toBeNull();
  });
});
