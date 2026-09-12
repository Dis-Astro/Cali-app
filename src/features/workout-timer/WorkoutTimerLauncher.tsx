import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Clock3, Minus, Pause, Play, Plus, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import ExerciseVideoRecorder from "@/components/coaching/ExerciseVideoRecorder";
import { useWorkoutTimer } from "./useWorkoutTimer";
import { formatTimerTime, getTimerTotalMs } from "./timerModel";
import { useTimerAudioCues, type TimerAudioEvent } from "./timerAudioCues";
import { playTimerTone, speakTimerMessage, unlockTimerAudio } from "./timerFeedback";
import { loadTimerSettings, parseTimerSettings, saveTimerSettings } from "./timerSettings";
import { TimerConfiguration } from "./TimerConfiguration";
import { DEFAULT_TIMER_CONFIG, TIMER_MODE_LABELS, type WorkoutTimerConfig, type WorkoutTimerMode } from "./types";
export { TimerConfiguration } from "./TimerConfiguration";

const MODES: WorkoutTimerMode[] = ["amrap", "stopwatch", "emom", "tabata", "mix"];
const COLORS: Record<WorkoutTimerMode, string> = { amrap: "#f39412", stopwatch: "#5468ff", emom: "#a000ee", tabata: "#00be99", mix: "#c4c4c4", countdown: "#e5b44b" };
const theme = (mode: WorkoutTimerMode) => ({ "--timer-accent": COLORS[mode] } as CSSProperties);
interface Props { exerciseName?: string | null; exerciseNotes?: string | null; sessionScope?: string; onComplete?: () => void }

function SwipeFinish({ onFinish }: { onFinish: () => void }) {
  const start = useRef<number | null>(null);
  const [travel, setTravel] = useState(0);
  return <div className="timer-swipe" role="button" tabIndex={0} aria-label="Scorri per finire il set"
    onPointerDown={(e) => { start.current = e.clientX; e.currentTarget.setPointerCapture(e.pointerId); }}
    onPointerMove={(e) => { if (start.current !== null) setTravel(Math.max(0, Math.min(190, e.clientX - start.current))); }}
    onPointerCancel={() => { start.current = null; setTravel(0); }}
    onPointerUp={(e) => {
      const distance = start.current === null ? 0 : e.clientX - start.current;
      start.current = null; setTravel(0);
      if (distance >= 130) onFinish();
    }}
    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (window.confirm("Terminare questo set?")) onFinish(); } }}>
    <span className="timer-swipe-handle" style={{ transform: `translateX(${travel}px)` }}>→</span>
    <span>SCORRI PER FINIRE</span>
  </div>;
}

export function WorkoutTimerScreen({ config, exerciseName, exerciseNotes, sessionScope = "standalone", onClose, onComplete }: Props & { config: WorkoutTimerConfig; onClose: () => void }) {
  const timer = useWorkoutTimer(config, sessionScope);
  const [silent, setSilent] = useState(config.silent);
  const silentRef = useRef(silent);
  const feedbackGeneration = useRef(0);
  const [prep, setPrep] = useState<number | null>(null);
  const [showWorkout, setShowWorkout] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const generation = useRef(0);
  const mounted = useRef(false);
  const completion = useRef(false);
  const completionTimeout = useRef<number | null>(null);
  const previous = useRef({ segment: -1, round: -1, second: -1, signal: 0 });
  const halfwaySegments = useRef(new Set<number>());
  const audioEvents = useMemo<TimerAudioEvent[]>(() => ["start", "finish", "motivation", "halfway", "round_end", "last_round"], []);
  const audio = useTimerAudioCues(audioEvents);
  const audioPlay = audio.play;
  const audioStop = audio.stop;
  const audioPrime = audio.prime;
  const snapshot = timer.snapshot;
  const currentMode = snapshot.activeMode ?? config.mode;
  const accent = snapshot.phase === "rest" ? "#bcbcbc" : COLORS[currentMode];
  const playEvent = useCallback(async (event: TimerAudioEvent, fallback: () => void) => {
    if (silentRef.current || !mounted.current) return;
    const version = feedbackGeneration.current;
    const ok = await audioPlay(event).catch(() => false);
    if (!ok && mounted.current && !silentRef.current && version === feedbackGeneration.current) fallback();
  }, [audioPlay]);
  const clearPrep = useCallback(() => {
    generation.current++;
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);
  useEffect(() => {
    mounted.current = true;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      mounted.current = false; clearPrep(); audioStop();
      document.body.style.overflow = overflow;
      if (completionTimeout.current !== null) window.clearTimeout(completionTimeout.current);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [clearPrep, audioStop]);

  const start = async () => {
    if (prep !== null) return;
    clearPrep();
    const version = generation.current;
    setPrep(10);
    void audioPrime().catch(() => undefined);
    await unlockTimerAudio().catch(() => undefined);
    if (!mounted.current || version !== generation.current) return;
    const startsAt = Date.now() + 10_000;
    let last = 10;
    intervalRef.current = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((startsAt - Date.now()) / 1000));
      setPrep(remaining);
      if (remaining !== last && remaining > 0 && remaining <= 3) playTimerTone("tick", silentRef.current);
      last = remaining;
      if (remaining === 0) {
        clearPrep(); setPrep(null);
        void playEvent("start", () => { playTimerTone("start", silentRef.current); speakTimerMessage("Via", silentRef.current); });
        timer.start(startsAt);
      }
    }, 100);
  };

  useEffect(() => {
    if (timer.status !== "running" || snapshot.finished) return;
    const second = Math.ceil(snapshot.mainRemainingMs / 1000);
    const last = previous.current;
    if (!(currentMode === "stopwatch" && snapshot.phase === "work") && second >= 1 && second <= 3 && second !== last.second) playTimerTone("tick", silent);
    const segment = snapshot.segmentIndex ?? 0;
    const duration = snapshot.segmentDurationMs;
    if (snapshot.phase === "work" && duration && duration >= 60_000 && (snapshot.segmentElapsedMs ?? 0) >= duration / 2 && !halfwaySegments.current.has(segment)) {
      halfwaySegments.current.add(segment);
      void playEvent("halfway", () => speakTimerMessage("Metà tempo", silent));
    }
    if (last.segment >= 0 && (segment !== last.segment || snapshot.round !== last.round)) {
      const event = snapshot.isLastRound && snapshot.phase === "work" ? "last_round" : "round_end";
      void playEvent(event, () => playTimerTone("phase", silent));
    }
    const signal = currentMode === "stopwatch" && snapshot.phase === "work" && config.signalSeconds
      ? Math.floor((snapshot.segmentElapsedMs ?? 0) / (config.signalSeconds * 1000)) : 0;
    if (signal > 0 && (segment !== last.segment || signal > last.signal)) playTimerTone("phase", silent);
    previous.current = { segment, round: snapshot.round, second, signal };
  }, [config.signalSeconds, currentMode, snapshot, timer.status, playEvent, silent]);

  useEffect(() => {
    if (timer.status !== "finished" || completion.current) return;
    completion.current = true;
    void (async () => {
      await playEvent("finish", () => playTimerTone("finish", silent));
      await playEvent("motivation", () => speakTimerMessage("Allenamento completato. Ottimo lavoro!", silent));
    })();
    if (onComplete) completionTimeout.current = window.setTimeout(() => { onClose(); onComplete(); }, 1400);
  }, [onClose, onComplete, playEvent, silent, timer.status]);

  const reset = () => {
    if (!window.confirm("Azzerare il timer corrente?")) return;
    clearPrep(); setPrep(null); feedbackGeneration.current++; audioStop();
    if (completionTimeout.current !== null) window.clearTimeout(completionTimeout.current);
    completion.current = false; previous.current = { segment: -1, round: -1, second: -1, signal: 0 };
    halfwaySegments.current.clear();
    timer.reset();
  };
  const close = () => {
    if ((timer.status === "running" || timer.status === "paused" || prep !== null) && !window.confirm("Interrompere il workout?")) return;
    clearPrep(); audioStop(); timer.reset(); onClose();
  };
  const tapClock = () => {
    if (prep !== null) { clearPrep(); setPrep(null); return; }
    if (timer.status === "idle") void start();
    else if (timer.status === "running") timer.pause();
    else if (timer.status === "paused") timer.resume();
  };
  const elapsedDisplay = currentMode === "stopwatch" && snapshot.phase !== "rest";
  const deathBy = currentMode === "emom" && config.emomOpenEnded && config.mode !== "mix";
  const progress = snapshot.segmentDurationMs ? Math.max(0, Math.min(1, (deathBy ? (snapshot.segmentElapsedMs ?? 0) % snapshot.segmentDurationMs : snapshot.segmentElapsedMs ?? 0) / snapshot.segmentDurationMs)) : 0;
  const clockLabel = prep !== null ? "Annulla partenza" : timer.status === "idle" ? "Avvia" : timer.status === "running" ? "Pausa" : timer.status === "paused" ? "Riprendi" : "Completato";
  return <div className="timer-run native-safe-top native-safe-bottom" style={{ ...theme(config.mode), "--timer-current": accent } as CSSProperties} data-testid="workout-timer-screen">
    <header className="timer-run-header">
      <button className="timer-icon" aria-label="Chiudi timer" onClick={close}><ArrowLeft/></button>
      <div className="min-w-0 text-center">
        <p className="text-sm font-semibold">{config.mode === "mix" ? `MIX · ${TIMER_MODE_LABELS[currentMode].title}` : TIMER_MODE_LABELS[config.mode].title}</p>
        {(snapshot.totalSets ?? 1) > 1 && <p className="text-sm">{snapshot.set} di {snapshot.totalSets}{snapshot.phase === "rest" ? " · Riposo" : ""}</p>}
      </div>
      <div className="flex gap-1">
        <ExerciseVideoRecorder compact exerciseName={exerciseName ?? null} className="h-11 border-white/20 bg-transparent text-white"/>
        <button className="timer-icon" aria-label={silent ? "Attiva audio" : "Disattiva audio"} onClick={() => {
          feedbackGeneration.current++; audioStop();
          if ("speechSynthesis" in window) window.speechSynthesis.cancel();
          silentRef.current = !silentRef.current; setSilent(silentRef.current);
        }}>{silent ? <VolumeX/> : <Volume2/>}</button>
      </div>
    </header>
    <main className="timer-run-main">
      {config.mode === "amrap" && config.showAmrapReps && <p className="text-sm text-white/70">{config.amrapReps} rep per serie</p>}
      {snapshot.label && <p className="max-w-full truncate text-center text-sm">{snapshot.label}</p>}
      {snapshot.totalRounds !== null && <p className="timer-round-label">{snapshot.round} / {snapshot.totalRounds}</p>}
      {deathBy && <p className="timer-round-label">Round {snapshot.round} · Death By</p>}
      {snapshot.phase === "rest" && <p className="text-sm uppercase tracking-widest text-white/60">Riposo</p>}
      <button className="timer-clock-button" aria-label={clockLabel} onClick={tapClock} disabled={timer.status === "finished"}>
        {prep === null && timer.status !== "idle" && timer.status !== "paused" && currentMode !== "stopwatch" && <svg className="timer-ring" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={591} strokeDashoffset={591 * progress} transform="rotate(-90 100 100)"/></svg>}
        <span data-testid="timer-display" className="timer-digits">
          {prep !== null ? prep : timer.status === "idle" ? <Play size={100} fill="currentColor"/> : timer.status === "paused" ? <Pause size={92} fill="currentColor"/> : formatTimerTime(snapshot.mainRemainingMs, elapsedDisplay ? "elapsed" : "remaining")}
        </span>
      </button>
      {timer.status === "paused" && <p className="text-sm text-white/55">In pausa · {formatTimerTime(snapshot.mainRemainingMs, elapsedDisplay ? "elapsed" : "remaining")}</p>}
      {timer.status === "finished" && <p className="font-semibold">ALLENAMENTO COMPLETATO</p>}
      {snapshot.overallRemainingMs !== null && (snapshot.totalRounds !== null || (snapshot.totalSets ?? 1) > 1 || config.mode === "mix") && <p className="mt-2 text-xs text-white/50">Tempo totale rimanente: {formatTimerTime(snapshot.overallRemainingMs)}</p>}
    </main>
    <footer className="timer-run-footer">
      <button className="text-left text-xs" onClick={() => setShowWorkout(true)}>Mostra l’allenamento</button>
      <div className="flex flex-col items-center gap-2">
        {currentMode === "stopwatch" && snapshot.phase === "work" && timer.status === "running" && <SwipeFinish onFinish={timer.completeSet}/>}
        {deathBy && timer.status === "running" && <SwipeFinish onFinish={timer.finish}/>}
        {(timer.status === "paused" || timer.status === "finished") && <button className="timer-icon" aria-label="Azzera" onClick={reset}><RotateCcw size={18}/></button>}
      </div>
      <div className="flex items-center justify-end gap-2">
        {timer.completedRounds > 0 && <button aria-label="Rimuovi round" onClick={() => timer.adjustRounds(-1)} className="timer-icon"><Minus size={14}/></button>}
        <span className="text-sm tabular-nums" data-testid="amrap-rounds">{timer.completedRounds}</span>
        <button className="timer-plus" disabled={timer.status !== "running" && timer.status !== "paused"} aria-label="Aggiungi round" onClick={() => timer.adjustRounds(1)}><Plus/></button>
      </div>
    </footer>
    <Dialog open={showWorkout} onOpenChange={setShowWorkout}><DialogContent className="z-[220] max-h-[85dvh] overflow-y-auto border-white/20 bg-neutral-950 text-white">
      <DialogTitle>{exerciseName || "Allenamento"}</DialogTitle><DialogDescription>{exerciseNotes || "Sequenza del timer"}</DialogDescription>
      <ol className="space-y-2">{timer.segments.slice(Math.max(0, (snapshot.segmentIndex ?? 0) - 5), Math.max(0, (snapshot.segmentIndex ?? 0) - 5) + 100).map((segment, i) => <li key={i} className={snapshot.segmentIndex === i + Math.max(0, (snapshot.segmentIndex ?? 0) - 5) ? "font-bold" : "text-white/60"}>{segment.set > 1 ? `Set ${segment.set} · ` : ""}{segment.label || (segment.phase === "rest" ? "Riposo" : TIMER_MODE_LABELS[segment.mode].title)} · {segment.durationMs === null ? "Senza limite" : formatTimerTime(segment.durationMs)}</li>)}</ol>
      {timer.segments.length > 100 && <p className="text-xs text-white/50">Anteprima di 100 intervalli intorno a quello corrente, su {timer.segments.length} totali.</p>}
    </DialogContent></Dialog>
  </div>;
}

export default function WorkoutTimerLauncher({ exerciseName, exerciseNotes, onComplete, sessionScope = "standalone" }: Props) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState(false);
  const [config, setConfig] = useState(DEFAULT_TIMER_CONFIG);
  const [presetPanel, setPresetPanel] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presets, setPresets] = useState<{ name: string; config: WorkoutTimerConfig }[]>([]);
  const presetKey = `spg:timer-presets:v1:${sessionScope.split(":")[0]}`;
  const validation = useMemo(() => {
    try { return { total: getTimerTotalMs(config), error: "" }; }
    catch { return { total: null, error: "Completa i gruppi vuoti e rispetta i limiti: 3 livelli, 80 blocchi e 5000 intervalli. Se necessario riduci le ripetizioni." }; }
  }, [config]);
  const total = validation.total;
  const openPresets = () => {
    try { const stored = JSON.parse(localStorage.getItem(presetKey) ?? "[]"); setPresets(Array.isArray(stored) ? stored.slice(0, 30).flatMap((p) => {
      const parsed = p && parseTimerSettings(p.config);
      return parsed && typeof p.name === "string" ? [{ name: p.name.slice(0, 60), config: parsed }] : [];
    }) : []); } catch { setPresets([]); }
    setPresetPanel(true);
  };
  const launch = () => { if (validation.error || (config.mode === "mix" && !config.mixBlocks?.length)) return; saveTimerSettings(config); setOpen(false); setRunning(true); };
  return <>
    <button type="button" className="flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 text-primary"
      aria-label={`Apri timer${exerciseName ? ` per ${exerciseName}` : ""}`} data-testid="workout-timer-launcher"
      onClick={(e) => { e.stopPropagation(); setSelected(false); setOpen(true); }}><Clock3 size={20}/><span className="text-xs sm:hidden">Timer</span></button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="timer-setup" style={theme(config.mode)}>
      <header className="flex shrink-0 items-center justify-between gap-3">
        <button className="timer-icon" aria-label={selected ? "Cambia modalità" : "Chiudi configurazione"} onClick={() => selected ? setSelected(false) : setOpen(false)}><ArrowLeft/></button>
        <DialogTitle>{selected ? TIMER_MODE_LABELS[config.mode].title : "TIMER"}</DialogTitle>
        {selected ? <button className="timer-icon text-xs" aria-label="Preset" onClick={openPresets}>♡</button> : <span className="w-11"/>}
      </header>
      <DialogDescription className="sr-only">Configura il timer, poi premi avvia e il pulsante di partenza.</DialogDescription>
      <div className="min-h-0 flex-1 overflow-y-auto py-4">
        {!selected ? <div className="timer-mode-list">{MODES.map((mode) => <button key={mode} style={{ background: COLORS[mode] }} onClick={() => { setConfig(loadTimerSettings(mode)); setSelected(true); }}>{TIMER_MODE_LABELS[mode].title}</button>)}
          <button className="timer-recovery" onClick={() => { setConfig(loadTimerSettings("countdown")); setSelected(true); }}>Countdown · recupero</button>
        </div> : <div className="mx-auto max-w-md"><TimerConfiguration config={config} onChange={setConfig}/></div>}
      </div>
      {selected && <footer className="shrink-0 space-y-3">
        <button className="flex h-10 w-full items-center justify-center gap-2 text-xs text-white/60" onClick={() => setConfig({ ...config, silent: !config.silent })}>{config.silent ? <VolumeX size={16}/> : <Volume2 size={16}/>} Segnali sonori {config.silent ? "disattivati" : "attivati"}</button>
        {validation.error && <p role="alert" className="text-sm text-red-300">{validation.error}</p>}
        <button disabled={!!validation.error || (config.mode === "mix" && !config.mixBlocks?.length)} className="timer-launch" onClick={launch}>AVVIA IL TIMER{total !== null && <small>Tempo totale: {formatTimerTime(total)}</small>}</button>
      </footer>}
    </DialogContent></Dialog>
    <Dialog open={presetPanel} onOpenChange={setPresetPanel}><DialogContent className="z-[230] max-h-[80dvh] overflow-auto bg-neutral-950 text-white">
      <DialogTitle>Preset</DialogTitle><DialogDescription>Salva questa configurazione sul dispositivo per riutilizzarla.</DialogDescription>
      <input aria-label="Nome preset" className="h-11 rounded-lg bg-white/10 px-3" maxLength={60} value={presetName} onChange={(e) => setPresetName(e.target.value)}/>
      <button className="timer-launch" disabled={!presetName.trim() || !!validation.error} onClick={() => {
        const next = [...presets.filter((p) => p.name !== presetName.trim()), { name: presetName.trim(), config }].slice(-30);
        try { localStorage.setItem(presetKey, JSON.stringify(next)); setPresets(next); setPresetName(""); } catch { window.alert("Preset non salvato: memoria locale non disponibile."); }
      }}>Salva preset</button>
      {presets.map((p, i) => <button key={i} className="rounded-lg border border-white/20 p-3 text-left" onClick={() => {
        if (p?.config && typeof p.name === "string" && parseTimerSettings(p.config)) {
          saveTimerSettings(p.config); setConfig(loadTimerSettings(p.config.mode)); setSelected(true); setPresetPanel(false);
        }
      }}>{typeof p?.name === "string" ? p.name : "Preset non valido"}</button>)}
    </DialogContent></Dialog>
    {running && createPortal(<WorkoutTimerScreen key={sessionScope} sessionScope={sessionScope} config={config} exerciseName={exerciseName} exerciseNotes={exerciseNotes}
      onClose={() => { setRunning(false); setOpen(true); }}
      onComplete={onComplete ? () => { setOpen(false); onComplete(); } : undefined}/>, document.body)}
  </>;
}
