import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Clock3,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  TimerReset,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatTimerTime } from "./timerModel";
import { playTimerTone, unlockTimerAudio } from "./timerFeedback";
import { useWorkoutTimer } from "./useWorkoutTimer";
import {
  DEFAULT_TIMER_CONFIG,
  TIMER_MODE_LABELS,
  type WorkoutTimerConfig,
  type WorkoutTimerMode,
} from "./types";

const MODES: WorkoutTimerMode[] = ["countdown", "stopwatch", "emom", "tabata", "amrap"];
const COUNTDOWN_PRESETS = [30, 45, 60, 90, 120, 180];

interface WorkoutTimerLauncherProps {
  exerciseName?: string | null;
}

function NumberField({
  label,
  value,
  min = 1,
  max = 3600,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="relative">
        <Input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value) || min)))}
          className="h-12 rounded-xl pr-12 text-lg font-semibold"
        />
        {suffix && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );
}

function TimerConfiguration({ config, onChange }: { config: WorkoutTimerConfig; onChange: (config: WorkoutTimerConfig) => void }) {
  const update = <Key extends keyof WorkoutTimerConfig>(key: Key, value: WorkoutTimerConfig[Key]) => {
    onChange({ ...config, [key]: value });
  };

  if (config.mode === "stopwatch") {
    return <p className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">Parte da zero e continua finché non lo metti in pausa o lo termini.</p>;
  }

  if (config.mode === "countdown") {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {COUNTDOWN_PRESETS.map((seconds) => (
            <Button
              key={seconds}
              type="button"
              variant={config.durationSeconds === seconds ? "default" : "outline"}
              className="h-11 rounded-xl"
              onClick={() => update("durationSeconds", seconds)}
            >
              {seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds}s`}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Minuti" value={Math.floor(config.durationSeconds / 60)} min={0} max={180} onChange={(minutes) => update("durationSeconds", minutes * 60 + (config.durationSeconds % 60))} />
          <NumberField label="Secondi" value={config.durationSeconds % 60} min={0} max={59} onChange={(seconds) => update("durationSeconds", Math.floor(config.durationSeconds / 60) * 60 + seconds)} />
        </div>
      </div>
    );
  }

  if (config.mode === "emom") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Round" value={config.rounds} max={99} onChange={(value) => update("rounds", value)} />
        <NumberField label="Intervallo" value={config.intervalSeconds} max={600} suffix="sec" onChange={(value) => update("intervalSeconds", value)} />
      </div>
    );
  }

  if (config.mode === "tabata") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Lavoro" value={config.workSeconds} max={600} suffix="sec" onChange={(value) => update("workSeconds", value)} />
        <NumberField label="Recupero" value={config.restSeconds} max={600} suffix="sec" onChange={(value) => update("restSeconds", value)} />
        <NumberField label="Round" value={config.rounds} max={99} onChange={(value) => update("rounds", value)} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <NumberField label="Minuti" value={Math.floor(config.durationSeconds / 60)} min={0} max={180} onChange={(minutes) => update("durationSeconds", minutes * 60 + (config.durationSeconds % 60))} />
      <NumberField label="Secondi" value={config.durationSeconds % 60} min={0} max={59} onChange={(seconds) => update("durationSeconds", Math.floor(config.durationSeconds / 60) * 60 + seconds)} />
    </div>
  );
}

function WorkoutTimerScreen({
  config,
  exerciseName,
  onClose,
}: {
  config: WorkoutTimerConfig;
  exerciseName?: string | null;
  onClose: () => void;
}) {
  const timer = useWorkoutTimer(config);
  const [amrapRounds, setAmrapRounds] = useState(0);
  const previousSecondRef = useRef<number | null>(null);
  const previousPhaseRef = useRef(timer.snapshot.phase);
  const finishPlayedRef = useRef(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const currentSecond = Math.ceil(timer.snapshot.mainRemainingMs / 1000);
    if (timer.status === "running" && currentSecond !== previousSecondRef.current && currentSecond >= 1 && currentSecond <= 3) {
      playTimerTone("tick", config.silent);
    }
    previousSecondRef.current = currentSecond;
  }, [config.silent, timer.snapshot.mainRemainingMs, timer.status]);

  useEffect(() => {
    if (timer.status === "running" && previousPhaseRef.current !== timer.snapshot.phase) {
      playTimerTone("phase", config.silent);
    }
    previousPhaseRef.current = timer.snapshot.phase;
  }, [config.silent, timer.snapshot.phase, timer.status]);

  useEffect(() => {
    if (timer.status === "finished" && !finishPlayedRef.current) {
      finishPlayedRef.current = true;
      playTimerTone("finish", config.silent);
    }
    if (timer.status === "idle") finishPlayedRef.current = false;
  }, [config.silent, timer.status]);

  const handleStart = async () => {
    await unlockTimerAudio().catch(() => undefined);
    playTimerTone("phase", config.silent);
    timer.start();
  };

  const handleReset = () => {
    if (timer.status !== "idle" && !window.confirm("Azzerare il timer corrente?")) return;
    timer.reset();
    setAmrapRounds(0);
  };

  const handleClose = () => {
    if (timer.status === "running" && !window.confirm("Il timer è in esecuzione. Vuoi chiuderlo?")) return;
    timer.reset();
    onClose();
  };

  const phaseLabel = timer.snapshot.phase === "rest" ? "RECUPERO" : timer.snapshot.phase === "finished" ? "COMPLETATO" : "LAVORO";
  const accentClass = timer.snapshot.phase === "rest"
    ? "text-emerald-400"
    : timer.snapshot.phase === "finished"
      ? "text-primary"
      : timer.snapshot.mainRemainingMs <= 3000 && timer.status === "running"
        ? "text-red-400"
        : "text-foreground";

  return (
    <div className="fixed inset-0 z-[100] flex min-h-[100dvh] flex-col overflow-hidden bg-black text-white native-safe-top native-safe-bottom" data-testid="workout-timer-screen">
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 native-safe-x">
        <div className="min-w-0">
          <p className="font-display text-2xl tracking-widest text-primary">{TIMER_MODE_LABELS[config.mode].title.toUpperCase()}</p>
          {exerciseName && <p className="truncate text-xs text-white/55">{exerciseName}</p>}
        </div>
        <button type="button" onClick={handleClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10" aria-label="Chiudi timer">
          <X className="h-5 w-5" />
        </button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 text-center native-safe-x">
        {(config.mode === "emom" || config.mode === "tabata") && (
          <p className="mb-2 text-sm font-bold tracking-[0.25em] text-white/60">
            ROUND {timer.snapshot.round} / {timer.snapshot.totalRounds}
          </p>
        )}
        {config.mode === "tabata" && <p className={cn("mb-1 font-display text-3xl tracking-widest", accentClass)}>{phaseLabel}</p>}
        <p data-testid="timer-display" className={cn("select-none font-display text-[clamp(6rem,29vw,13rem)] leading-none tabular-nums tracking-tight", accentClass)}>
          {formatTimerTime(timer.snapshot.mainRemainingMs)}
        </p>
        {timer.snapshot.overallRemainingMs !== null && (config.mode === "emom" || config.mode === "tabata") && (
          <p className="mt-3 text-sm text-white/50">Totale rimanente {formatTimerTime(timer.snapshot.overallRemainingMs)}</p>
        )}

        {config.mode === "amrap" && (
          <div className="mt-8 flex items-center gap-5 rounded-3xl border border-white/10 bg-white/5 p-3">
            <button type="button" onClick={() => setAmrapRounds((value) => Math.max(0, value - 1))} className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10" aria-label="Rimuovi round">
              <Minus className="h-6 w-6" />
            </button>
            <div className="min-w-28">
              <p className="text-xs font-bold uppercase tracking-widest text-white/50">Round</p>
              <p className="font-display text-6xl leading-none text-primary">{amrapRounds}</p>
            </div>
            <button type="button" onClick={() => setAmrapRounds((value) => value + 1)} className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-black" aria-label="Aggiungi round">
              <Plus className="h-7 w-7" />
            </button>
          </div>
        )}
      </main>

      <footer className="shrink-0 space-y-3 px-4 pb-5 native-safe-x">
        {timer.status === "idle" && (
          <Button onClick={() => void handleStart()} className="h-16 w-full rounded-2xl text-lg font-bold" data-testid="timer-start">
            <Play className="mr-2 h-6 w-6 fill-current" /> Avvia
          </Button>
        )}
        {timer.status === "running" && (
          <Button onClick={timer.pause} className="h-16 w-full rounded-2xl bg-white text-lg font-bold text-black hover:bg-white/90">
            <Pause className="mr-2 h-6 w-6 fill-current" /> Pausa
          </Button>
        )}
        {timer.status === "paused" && (
          <Button onClick={timer.resume} className="h-16 w-full rounded-2xl text-lg font-bold">
            <Play className="mr-2 h-6 w-6 fill-current" /> Riprendi
          </Button>
        )}
        {timer.status === "finished" && <p className="text-center font-display text-3xl tracking-widest text-primary">SESSIONE COMPLETATA</p>}
        <Button variant="ghost" onClick={handleReset} className="h-11 w-full rounded-xl text-white/65 hover:bg-white/10 hover:text-white">
          <RotateCcw className="mr-2 h-4 w-4" /> Azzera
        </Button>
      </footer>
    </div>
  );
}

export default function WorkoutTimerLauncher({ exerciseName }: WorkoutTimerLauncherProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [config, setConfig] = useState<WorkoutTimerConfig>(DEFAULT_TIMER_CONFIG);

  const launchTimer = () => {
    setSheetOpen(false);
    setTimerOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setSheetOpen(true);
        }}
        className="flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 text-primary transition hover:bg-primary/15 active:scale-95"
        aria-label={`Apri timer${exerciseName ? ` per ${exerciseName}` : ""}`}
        data-testid="workout-timer-launcher"
      >
        <Clock3 className="h-5 w-5" />
        <span className="text-xs font-semibold sm:hidden">Timer</span>
      </button>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-3xl border-white/10 px-4 pb-[calc(1.25rem+var(--safe-bottom))] pt-5 sm:mx-auto sm:max-w-lg">
          <SheetHeader className="pr-8 text-left">
            <SheetTitle className="flex items-center gap-2 font-display text-3xl tracking-wider"><TimerReset className="h-6 w-6 text-primary" /> TIMER</SheetTitle>
            <SheetDescription>Scegli liberamente la modalità. La scheda e le note del coach non vengono modificate.</SheetDescription>
          </SheetHeader>

          <div className="mt-5 grid grid-cols-2 gap-2">
            {MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setConfig((current) => ({ ...current, mode }))}
                className={cn(
                  "rounded-2xl border p-3 text-left transition",
                  config.mode === mode ? "border-primary bg-primary/10" : "border-border bg-muted/20 hover:bg-muted/40",
                )}
              >
                <span className="block font-semibold">{TIMER_MODE_LABELS[mode].title}</span>
                <span className="mt-1 block text-xs leading-snug text-muted-foreground">{TIMER_MODE_LABELS[mode].description}</span>
              </button>
            ))}
          </div>

          <div className="mt-5">
            <TimerConfiguration config={config} onChange={setConfig} />
          </div>

          <button
            type="button"
            onClick={() => setConfig((current) => ({ ...current, silent: !current.silent }))}
            className="mt-4 flex w-full items-center justify-between rounded-2xl border border-border bg-muted/20 p-4 text-left"
          >
            <span>
              <span className="block text-sm font-semibold">Segnali sonori e vibrazione</span>
              <span className="block text-xs text-muted-foreground">Puoi usare il timer anche in modalità silenziosa</span>
            </span>
            {config.silent ? <VolumeX className="h-5 w-5 text-muted-foreground" /> : <Volume2 className="h-5 w-5 text-primary" />}
          </button>

          <Button onClick={launchTimer} className="mt-5 h-14 w-full rounded-2xl text-base font-bold">
            Apri timer
          </Button>
        </SheetContent>
      </Sheet>

      {timerOpen && typeof document !== "undefined" && createPortal(
        <WorkoutTimerScreen config={config} exerciseName={exerciseName} onClose={() => setTimerOpen(false)} />,
        document.body,
      )}
    </>
  );
}
