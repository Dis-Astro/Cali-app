import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StrictMode, useState } from "react";
import WorkoutTimerLauncher, { TimerConfiguration, WorkoutTimerScreen } from "./WorkoutTimerLauncher";
import { DEFAULT_TIMER_CONFIG } from "./types";
import { playTimerTone, speakTimerMessage } from "./timerFeedback";
const audio = vi.hoisted(() => ({ play: vi.fn(async () => false), prime: vi.fn(async () => undefined), stop: vi.fn() }));
vi.mock("./timerAudioCues", () => ({ useTimerAudioCues: () => audio }));
vi.mock("./timerFeedback", () => ({ playTimerTone: vi.fn(), speakTimerMessage: vi.fn(), unlockTimerAudio: vi.fn(async () => undefined) }));
vi.mock("@/components/coaching/ExerciseVideoRecorder", () => ({ default: () => <button>Registra video</button> }));
const advance = async (ms: number) => { await act(async () => { vi.advanceTimersByTime(ms); }); };
const start = async () => { await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Avvia" })); }); await advance(10_000); };
afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear(); vi.restoreAllMocks(); audio.play.mockReset().mockResolvedValue(false); });

describe("SmartWOD-observed timer flows", () => {
  it("honours mute toggled during the preparation countdown", async () => {
    vi.useFakeTimers();
    render(<WorkoutTimerScreen config={DEFAULT_TIMER_CONFIG} onClose={vi.fn()}/>);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Avvia" })); });
    fireEvent.click(screen.getByRole("button", { name: "Disattiva audio" }));
    audio.play.mockClear(); vi.mocked(playTimerTone).mockClear();
    await advance(10_000);
    expect(audio.play).not.toHaveBeenCalled();
    expect(vi.mocked(playTimerTone).mock.calls.every((call) => call[1] === true)).toBe(true);
    expect(screen.getByRole("button", { name: "Pausa" })).toBeVisible();
  });
  it("preserves the optional AMRAP repetition target through setup and ready screen", () => {
    render(<WorkoutTimerLauncher/>);
    fireEvent.click(screen.getByRole("button", { name: "Apri timer" }));
    fireEvent.click(screen.getByRole("button", { name: "AMRAP" }));
    fireEvent.click(screen.getByRole("button", { name: /Obiettivo ripetizioni/ }));
    fireEvent.click(screen.getByRole("button", { name: "Ripetizioni per serie: 10" }));
    fireEvent.keyDown(screen.getByRole("listbox", { name: "Ripetizioni per serie" }), { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    fireEvent.click(screen.getByRole("button", { name: /AVVIA IL TIMER/ }));
    expect(screen.getByText("11 rep per serie")).toBeVisible();
  });
  it("offers five modes plus recovery and keeps start outside the scroll area", () => {
    render(<WorkoutTimerLauncher/>);
    fireEvent.click(screen.getByRole("button", { name: "Apri timer" }));
    for (const mode of ["AMRAP", "FOR TIME", "EMOM", "Tabata", "MIX", "Countdown"]) expect(screen.getByRole("button", { name: new RegExp(mode) })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Tabata" }));
    expect(screen.getByRole("button", { name: /AVVIA IL TIMER/ })).toHaveTextContent("03:50");
    expect(screen.getByRole("button", { name: /AVVIA IL TIMER/ }).closest("footer")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Aggiungi set/ }));
    expect(screen.getByRole("button", { name: /AVVIA IL TIMER/ })).toHaveTextContent("15:30");
  });
  it("configures independent AMRAP sets, allows zero recovery and persists settings", () => {
    render(<WorkoutTimerLauncher/>);
    fireEvent.click(screen.getByRole("button", { name: "Apri timer" }));
    fireEvent.click(screen.getByRole("button", { name: "AMRAP" }));
    expect(screen.getByRole("button", { name: "Durata AMRAP 1: 10:00" })).toHaveTextContent("10:00");
    fireEvent.click(screen.getByRole("button", { name: /Aggiungi più AMRAP/ }));
    expect(screen.getByRole("button", { name: /AVVIA IL TIMER/ })).toHaveTextContent("22:00");
    fireEvent.click(screen.getByRole("button", { name: /Riposo dopo AMRAP 1/ }));
    fireEvent.keyDown(screen.getByRole("listbox", { name: "Minuti" }), { key: "Home" });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.getByRole("button", { name: /AVVIA IL TIMER/ })).toHaveTextContent("20:00");
    fireEvent.click(screen.getByRole("button", { name: /AVVIA IL TIMER/ }));
    expect(screen.getByRole("button", { name: "Avvia" })).toBeVisible();
    expect(JSON.parse(localStorage.getItem("spg:timer-settings:v1:amrap")!).amrapSets).toEqual([{ durationSeconds: 600, restSeconds: 0 }, { durationSeconds: 600, restSeconds: 120 }]);
  });
  it("uses exact seconds without a keyboard and applies only on confirmation", () => {
    function Config() {
      const [config, setConfig] = useState({ ...DEFAULT_TIMER_CONFIG, durationSeconds: 75 });
      return <><TimerConfiguration config={config} onChange={setConfig}/><output>{config.durationSeconds}</output></>;
    }
    render(<Config/>);
    fireEvent.click(screen.getByRole("button", { name: /Durata/ }));
    const seconds = screen.getByRole("listbox", { name: "Secondi" });
    fireEvent.keyDown(seconds, { key: "ArrowDown" });
    fireEvent.keyDown(seconds, { key: "ArrowDown" });
    expect(screen.queryByRole("spinbutton")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.getByRole("status")).toHaveTextContent("77");
  });
  it("waits for Play under StrictMode and resumes without a second preparation", async () => {
    vi.useFakeTimers();
    render(<StrictMode><WorkoutTimerScreen config={DEFAULT_TIMER_CONFIG} onClose={vi.fn()}/></StrictMode>);
    await advance(20_000);
    expect(screen.getByRole("button", { name: "Avvia" })).toBeVisible();
    await start();
    expect(screen.getByTestId("timer-display")).toHaveTextContent("01:30");
    await advance(2_000);
    fireEvent.click(screen.getByRole("button", { name: "Pausa" }));
    await advance(5_000);
    expect(screen.getByText("In pausa · 01:28")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Riprendi" }));
    await advance(1_000);
    expect(screen.getByTestId("timer-display")).toHaveTextContent("01:27");
    expect(screen.getByRole("button", { name: "Registra video" })).toBeVisible();
  });
  it("counts rounds only after preparation, including FOR TIME", async () => {
    vi.useFakeTimers();
    render(<WorkoutTimerScreen config={{ ...DEFAULT_TIMER_CONFIG, mode: "stopwatch" }} onClose={vi.fn()}/>);
    expect(screen.getByRole("button", { name: "Aggiungi round" })).toBeDisabled();
    await start();
    fireEvent.click(screen.getByRole("button", { name: "Aggiungi round" }));
    expect(screen.getByTestId("amrap-rounds")).toHaveTextContent("1");
    fireEvent.click(screen.getByRole("button", { name: "Rimuovi round" }));
    expect(screen.getByTestId("amrap-rounds")).toHaveTextContent("0");
  });
  it("opens evaluation once at the end, never between AMRAP sets", async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn(), onClose = vi.fn();
    render(<WorkoutTimerScreen config={{ ...DEFAULT_TIMER_CONFIG, mode: "amrap", amrapSets: [{ durationSeconds: 2, restSeconds: 1 }, { durationSeconds: 2, restSeconds: 0 }] }} onClose={onClose} onComplete={onComplete}/>);
    await start(); await advance(2_000);
    expect(screen.getByText("Riposo", { exact: true })).toBeVisible();
    expect(onComplete).not.toHaveBeenCalled();
    await advance(3_000); await advance(1_400);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    await advance(5_000);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
  it("finishes only the current FOR TIME set with the accessible swipe control", async () => {
    vi.useFakeTimers(); vi.spyOn(window, "confirm").mockReturnValue(true);
    const onComplete = vi.fn();
    render(<WorkoutTimerScreen config={{ ...DEFAULT_TIMER_CONFIG, mode: "stopwatch", sets: 2, setRestSeconds: 2 }} onClose={vi.fn()} onComplete={onComplete}/>);
    await start(); await advance(3_000);
    fireEvent.keyDown(screen.getByRole("button", { name: "Scorri per finire il set" }), { key: "Enter" });
    expect(screen.getByText("Riposo", { exact: true })).toBeVisible();
    expect(onComplete).not.toHaveBeenCalled();
    await advance(2_000);
    expect(screen.getByTestId("timer-display")).toHaveTextContent("00:00");
    await advance(1_000);
    fireEvent.keyDown(screen.getByRole("button", { name: "Scorri per finire il set" }), { key: "Enter" });
    await advance(1_400);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
  it("can finish Death By without abandoning the workout", async () => {
    vi.useFakeTimers(); vi.spyOn(window, "confirm").mockReturnValue(true);
    const onComplete = vi.fn();
    render(<WorkoutTimerScreen config={{ ...DEFAULT_TIMER_CONFIG, mode: "emom", emomOpenEnded: true }} onClose={vi.fn()} onComplete={onComplete}/>);
    await start();
    fireEvent.keyDown(screen.getByRole("button", { name: "Scorri per finire il set" }), { key: "Enter" });
    await advance(1_400);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
  it("does not restart after cancelling preparation", async () => {
    vi.useFakeTimers();
    render(<WorkoutTimerScreen config={DEFAULT_TIMER_CONFIG} onClose={vi.fn()}/>);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Avvia" })); });
    fireEvent.click(screen.getByRole("button", { name: "Annulla partenza" }));
    await advance(20_000);
    expect(screen.getByRole("button", { name: "Avvia" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Pausa" })).toBeNull();
  });
  it("does not play delayed completion audio after unmount", async () => {
    vi.useFakeTimers();
    const view = render(<WorkoutTimerScreen config={{ ...DEFAULT_TIMER_CONFIG, durationSeconds: 2 }} onClose={vi.fn()}/>);
    await start(); await advance(1_000);
    let resolveAudio!: (played: boolean) => void;
    audio.play.mockImplementationOnce(() => new Promise<boolean>((resolve) => { resolveAudio = resolve; }));
    await advance(1_000);
    expect(audio.play).toHaveBeenLastCalledWith("finish");
    view.unmount();
    vi.mocked(playTimerTone).mockClear(); vi.mocked(speakTimerMessage).mockClear();
    await act(async () => { resolveAudio(false); });
    expect(playTimerTone).not.toHaveBeenCalled(); expect(speakTimerMessage).not.toHaveBeenCalled();
  });
});
