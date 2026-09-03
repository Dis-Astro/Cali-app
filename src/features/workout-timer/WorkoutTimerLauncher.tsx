import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Clock3,
  ChevronDown,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  TimerReset,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ExerciseVideoRecorder from "@/components/coaching/ExerciseVideoRecorder";
import { ColoredKeywordText } from "@/components/shared/ColoredKeywordText";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatTimerTime } from "./timerModel";
import { playTimerTone, speakTimerMessage, unlockTimerAudio } from "./timerFeedback";
import { useTimerAudioCues, type TimerAudioEvent } from "./timerAudioCues";
import { useWorkoutTimer } from "./useWorkoutTimer";
import {
  DEFAULT_TIMER_CONFIG,
  TIMER_MODE_LABELS,
  type WorkoutTimerConfig,
  type WorkoutTimerMode,
} from "./types";

const MODES: WorkoutTimerMode[] = ["countdown", "stopwatch", "emom", "tabata", "amrap"];
const START_PREPARATION_SECONDS = 10;
const MOTIVATIONAL_MESSAGES = [
  "Grande lavoro. Un passo in più verso il tuo obiettivo!",
  "Hai dato tutto. Ora recupera e torna ancora più forte!",
  "Sessione completata: la costanza costruisce i risultati!",
  "Ottimo lavoro. Ogni ripetizione conta!",
  "Fatto! Oggi hai superato te stesso!",
];

interface WorkoutTimerLauncherProps {
  exerciseName?: string | null;
  exerciseNotes?: string | null;
  onComplete?: () => void;
}

const numericOptions = (min: number, max: number, step = 1) =>
  Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, index) => min + index * step);

function ScrollSelect({
  label,
  value,
  options,
  format = (option: number) => String(option),
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  format?: (option: number) => string;
  onChange: (value: number) => void;
}) {
  const normalizedOptions = options.includes(value) ? options : [...options, value].sort((a, b) => a - b);
  return (
    <label className="min-w-0 space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-12 w-full appearance-none rounded-xl border border-input bg-background px-3 pr-9 text-base font-semibold outline-none focus:ring-2 focus:ring-ring"
        >
          {normalizedOptions.map((option) => <option key={option} value={option}>{format(option)}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </label>
  );
}

function TimeField({
  label,
  value,
  maxMinutes = 180,
  onChange,
}: {
  label: string;
  value: number;
  maxMinutes?: number;
  onChange: (value: number) => void;
}) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor((value % 60) / 10) * 10;
  const update = (nextMinutes: number, nextSeconds: number) => {
    onChange(Math.max(10, Math.min(maxMinutes * 60 + 50, nextMinutes * 60 + nextSeconds)));
  };

  return (
    <fieldset className="rounded-2xl border border-border bg-muted/20 px-3 pb-3 pt-2">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        <ScrollSelect label="Minuti" value={minutes} options={numericOptions(0, maxMinutes)} format={(option) => `${option} min`} onChange={(next) => update(next, seconds)} />
        <ScrollSelect label="Secondi" value={seconds} options={numericOptions(0, 50, 10)} format={(option) => `${option} sec`} onChange={(next) => update(minutes, next)} />
      </div>
    </fieldset>
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
    return <TimeField label="Durata" value={config.durationSeconds} onChange={(value) => update("durationSeconds", value)} />;
  }

  if (config.mode === "emom") {
    return (
      <div className="space-y-3">
        <TimeField label="Ogni quanto parte la serie" value={config.intervalSeconds} maxMinutes={30} onChange={(value) => update("intervalSeconds", value)} />
        <button
          type="button"
          onClick={() => update("emomOpenEnded", !config.emomOpenEnded)}
          className={cn(
            "flex w-full items-center justify-between rounded-2xl border p-4 text-left transition",
            config.emomOpenEnded ? "border-primary bg-primary/10" : "border-border bg-muted/20",
          )}
        >
          <span>
            <span className="block text-sm font-semibold">EMOM a cedimento</span>
            <span className="block text-xs text-muted-foreground">Continua finché decidi tu di fermarlo.</span>
          </span>
          <span className={cn("rounded-full px-3 py-1 text-xs font-bold", config.emomOpenEnded ? "bg-primary text-black" : "bg-muted text-muted-foreground")}>
            {config.emomOpenEnded ? "ATTIVO" : "NO"}
          </span>
        </button>
        {!config.emomOpenEnded && <ScrollSelect label="Numero di serie" value={config.rounds} options={numericOptions(1, 100)} onChange={(value) => update("rounds", value)} />}
      </div>
    );
  }

  if (config.mode === "tabata") {
    return (
      <div className="space-y-3">
        <TimeField label="Lavoro" value={config.workSeconds} maxMinutes={30} onChange={(value) => update("workSeconds", value)} />
        <TimeField label="Recupero" value={config.restSeconds} maxMinutes={30} onChange={(value) => update("restSeconds", value)} />
        <ScrollSelect label="Numero di serie" value={config.rounds} options={numericOptions(1, 100)} onChange={(value) => update("rounds", value)} />
      </div>
    );
  }

  return <TimeField label="Durata libera" value={config.durationSeconds} onChange={(value) => update("durationSeconds", value)} />;
}

function WorkoutTimerScreen({
  config,
  exerciseName,
  exerciseNotes,
  onClose,
  onComplete,
}: {
  config: WorkoutTimerConfig;
  exerciseName?: string | null;
  exerciseNotes?: string | null;
  onClose: () => void;
  onComplete?: () => void;
}) {
  const timer = useWorkoutTimer(config);
  const requiredAudioEvents = useMemo<TimerAudioEvent[]>(() => {
    const events: TimerAudioEvent[] = ["start", "finish", "motivation"];
    const hasFiniteDuration = config.mode !== "stopwatch" && !(config.mode === "emom" && config.emomOpenEnded);
    if (hasFiniteDuration) events.push("halfway");
    if (config.mode === "emom" || config.mode === "tabata") events.push("round_end");
    if ((config.mode === "emom" && !config.emomOpenEnded) || config.mode === "tabata") events.push("last_round");
    return events;
  }, [config.emomOpenEnded, config.mode]);
  const { play: playCustomAudio, prime: primeCustomAudio, stop: stopCustomAudio } = useTimerAudioCues(requiredAudioEvents);
  const [amrapRounds, setAmrapRounds] = useState(0);
  const [preStartCount, setPreStartCount] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [motivationalMessage] = useState(() => MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)]);
  const previousSecondRef = useRef<number | null>(null);
  const previousPhaseRef = useRef(timer.snapshot.phase);
  const previousRoundRef = useRef(timer.snapshot.round);
  const finishPlayedRef = useRef(false);
  const halfwayPlayedRef = useRef(false);
  const lastRoundPlayedRef = useRef(false);
  const preStartTimeoutsRef = useRef<number[]>([]);
  const announcementTimeoutRef = useRef<number | null>(null);
  const completionTimeoutRef = useRef<number | null>(null);
  const completionOpenedRef = useRef(false);

  const showAnnouncement = useCallback((message: string, speak = true) => {
    setAnnouncement(message);
    if (speak) speakTimerMessage(message, config.silent);
    if (announcementTimeoutRef.current !== null) window.clearTimeout(announcementTimeoutRef.current);
    announcementTimeoutRef.current = window.setTimeout(() => setAnnouncement(null), 2400);
  }, [config.silent]);

  const cancelPreStart = useCallback(() => {
    preStartTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
    preStartTimeoutsRef.current = [];
    setPreStartCount(null);
  }, []);

  const playEvent = useCallback(async (eventType: TimerAudioEvent, fallback: () => void) => {
    if (config.silent) return false;
    const played = await playCustomAudio(eventType);
    if (!played) fallback();
    return played;
  }, [config.silent, playCustomAudio]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      preStartTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
      if (announcementTimeoutRef.current !== null) window.clearTimeout(announcementTimeoutRef.current);
      if (completionTimeoutRef.current !== null) window.clearTimeout(completionTimeoutRef.current);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      stopCustomAudio();
    };
  }, [stopCustomAudio]);

  useEffect(() => {
    const currentSecond = Math.ceil(timer.snapshot.mainRemainingMs / 1000);
    if (timer.status === "running" && currentSecond !== previousSecondRef.current && currentSecond >= 1 && currentSecond <= 3) {
      playTimerTone("tick", config.silent);
    }
    previousSecondRef.current = currentSecond;
  }, [config.silent, timer.snapshot.mainRemainingMs, timer.status]);

  useEffect(() => {
    if (timer.status === "running" && previousPhaseRef.current !== timer.snapshot.phase) {
      if (timer.snapshot.phase === "rest") {
        void playEvent("round_end", () => playTimerTone("phase", config.silent));
      } else {
        playTimerTone("phase", config.silent);
      }
    }
    previousPhaseRef.current = timer.snapshot.phase;
  }, [config.silent, playEvent, timer.snapshot.phase, timer.status]);

  useEffect(() => {
    if (
      timer.status === "running"
      && timer.snapshot.totalMs !== null
      && timer.snapshot.elapsedMs >= timer.snapshot.totalMs / 2
      && !halfwayPlayedRef.current
    ) {
      halfwayPlayedRef.current = true;
      if (timer.snapshot.isLastRound && !lastRoundPlayedRef.current) {
        lastRoundPlayedRef.current = true;
        void playEvent("last_round", () => playTimerTone("last", config.silent));
        showAnnouncement("Metà tempo. Ultima serie");
      } else {
        void playEvent("halfway", () => playTimerTone("half", config.silent));
        showAnnouncement("Metà tempo");
      }
    }
  }, [config.silent, playEvent, showAnnouncement, timer.snapshot.elapsedMs, timer.snapshot.isLastRound, timer.snapshot.totalMs, timer.status]);

  useEffect(() => {
    if (
      timer.status === "running"
      && timer.snapshot.isLastRound
      && !lastRoundPlayedRef.current
      && (timer.snapshot.round !== previousRoundRef.current || timer.snapshot.round === 1)
    ) {
      lastRoundPlayedRef.current = true;
      void playEvent("last_round", () => playTimerTone("last", config.silent));
      showAnnouncement("Ultima serie");
    } else if (
      timer.status === "running"
      && config.mode === "emom"
      && timer.snapshot.round !== previousRoundRef.current
      && !timer.snapshot.isLastRound
    ) {
      void playEvent("round_end", () => playTimerTone("phase", config.silent));
    }
    previousRoundRef.current = timer.snapshot.round;
  }, [config.mode, config.silent, playEvent, showAnnouncement, timer.snapshot.isLastRound, timer.snapshot.round, timer.status]);

  useEffect(() => {
    if (timer.status === "finished" && !finishPlayedRef.current) {
      finishPlayedRef.current = true;
      showAnnouncement("Sessione completata", false);
      void (async () => {
        await playEvent("finish", () => playTimerTone("finish", config.silent));
        await playEvent("motivation", () => speakTimerMessage(motivationalMessage, config.silent));
      })();
      if (!completionOpenedRef.current) {
        completionOpenedRef.current = true;
        completionTimeoutRef.current = window.setTimeout(() => {
          onClose();
          onComplete?.();
        }, 1400);
      }
    }
    if (timer.status === "idle") {
      finishPlayedRef.current = false;
      halfwayPlayedRef.current = false;
      lastRoundPlayedRef.current = false;
      completionOpenedRef.current = false;
    }
  }, [config.silent, motivationalMessage, onClose, onComplete, playEvent, showAnnouncement, timer.status]);

  const handleStart = async () => {
    await Promise.all([
      unlockTimerAudio().catch(() => undefined),
      primeCustomAudio().catch(() => undefined),
    ]);
    cancelPreStart();
    setPreStartCount(START_PREPARATION_SECONDS);
    playTimerTone("tick", config.silent);
    Array.from({ length: START_PREPARATION_SECONDS - 1 }, (_, index) => START_PREPARATION_SECONDS - index - 1).forEach((value) => {
      const timeout = window.setTimeout(() => {
        setPreStartCount(value);
        if (value <= 3) playTimerTone("tick", config.silent);
      }, (START_PREPARATION_SECONDS - value) * 1000);
      preStartTimeoutsRef.current.push(timeout);
    });
    preStartTimeoutsRef.current.push(window.setTimeout(() => {
      setPreStartCount(null);
      void playEvent("start", () => {
        playTimerTone("start", config.silent);
        speakTimerMessage("Via", config.silent);
      });
      timer.start();
      preStartTimeoutsRef.current = [];
    }, START_PREPARATION_SECONDS * 1000));
  };

  const handleReset = () => {
    if (preStartCount !== null) {
      cancelPreStart();
      return;
    }
    if (timer.status !== "idle" && !window.confirm("Azzerare il timer corrente?")) return;
    timer.reset();
    setAmrapRounds(0);
  };

  const handleFinish = () => {
    if (!window.confirm("Terminare la sessione corrente?")) return;
    timer.finish();
  };

  const handleClose = () => {
    cancelPreStart();
    stopCustomAudio();
    if (timer.status === "running" && !window.confirm("Il timer è in esecuzione. Vuoi chiuderlo?")) return;
    timer.reset();
    onClose();
  };

  const phaseLabel = timer.snapshot.phase === "rest" ? "RECUPERO" : timer.snapshot.phase === "finished" ? "COMPLETATO" : "LAVORO";
  const accentClass = timer.status === "finished"
    ? "text-primary"
    : timer.snapshot.phase === "rest"
    ? "text-emerald-400"
    : timer.snapshot.mainRemainingMs <= 3000 && timer.status === "running"
        ? "text-red-400"
        : "text-foreground";

  return (
    <div className="fixed inset-0 z-[100] flex min-h-[100dvh] flex-col overflow-hidden bg-black text-white native-safe-top native-safe-bottom" data-testid="workout-timer-screen">
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 native-safe-x">
        <div className="min-w-0">
          <p className="font-display text-2xl tracking-widest text-primary">{TIMER_MODE_LABELS[config.mode].title.toUpperCase()}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ExerciseVideoRecorder exerciseName={exerciseName || null} compact className="h-11 border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white" />
          <button type="button" onClick={handleClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10" aria-label="Chiudi timer">
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      {(exerciseName || exerciseNotes) && (
        <section className="mx-4 max-h-28 shrink-0 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-left native-safe-x">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Esercizio</p>
          {exerciseName && <p className="whitespace-pre-wrap break-words text-sm font-semibold leading-relaxed text-white/90"><ColoredKeywordText text={exerciseName} /></p>}
          {exerciseNotes && <p className="mt-2 whitespace-pre-wrap break-words border-t border-white/10 pt-2 text-xs leading-relaxed text-white/65"><ColoredKeywordText text={exerciseNotes} /></p>}
        </section>
      )}

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 text-center native-safe-x">
        {announcement && (
          <div className="mb-3 rounded-full border border-primary/40 bg-primary/15 px-5 py-2 font-bold uppercase tracking-wider text-primary" role="status">
            {announcement}
          </div>
        )}
        {(config.mode === "emom" || config.mode === "tabata") && (
          <p className="mb-2 text-sm font-bold tracking-[0.25em] text-white/60">
            SERIE {timer.snapshot.round} / {timer.snapshot.totalRounds ?? "∞"}
          </p>
        )}
        {config.mode === "tabata" && <p className={cn("mb-1 font-display text-3xl tracking-widest", accentClass)}>{phaseLabel}</p>}
        <p data-testid="timer-display" className={cn("select-none font-display text-[clamp(6rem,29vw,13rem)] leading-none tabular-nums tracking-tight", accentClass)}>
          {preStartCount ?? formatTimerTime(timer.snapshot.mainRemainingMs)}
        </p>
        {preStartCount !== null && <p className="mt-3 font-display text-2xl tracking-widest text-primary">PREPARATI</p>}
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
        {timer.status === "idle" && preStartCount === null && (
          <Button onClick={() => void handleStart()} className="h-16 w-full rounded-2xl text-lg font-bold" data-testid="timer-start">
            <Play className="mr-2 h-6 w-6 fill-current" /> Avvia
          </Button>
        )}
        {preStartCount !== null && (
          <Button onClick={cancelPreStart} variant="outline" className="h-16 w-full rounded-2xl border-white/20 bg-white/5 text-lg font-bold text-white hover:bg-white/10 hover:text-white">
            Annulla partenza
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
        {(timer.status === "running" || timer.status === "paused") && ((config.mode === "emom" && config.emomOpenEnded) || config.mode === "stopwatch") && (
          <Button variant="outline" onClick={handleFinish} className="h-11 w-full rounded-xl border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary">
            Termina sessione
          </Button>
        )}
        {timer.status === "finished" && (
          <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-center">
            <p className="font-display text-3xl tracking-widest text-primary">SESSIONE COMPLETATA</p>
            <p className="mt-2 flex items-start justify-center gap-2 text-sm font-semibold text-white/85">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {motivationalMessage}
            </p>
          </div>
        )}
        <Button variant="ghost" onClick={handleReset} className="h-11 w-full rounded-xl text-white/65 hover:bg-white/10 hover:text-white">
          <RotateCcw className="mr-2 h-4 w-4" /> Azzera
        </Button>
      </footer>
    </div>
  );
}

export default function WorkoutTimerLauncher({ exerciseName, exerciseNotes, onComplete }: WorkoutTimerLauncherProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [config, setConfig] = useState<WorkoutTimerConfig>(DEFAULT_TIMER_CONFIG);

  const launchTimer = () => {
    setSheetOpen(false);
    setTimerOpen(true);
  };
  const closeTimer = useCallback(() => setTimerOpen(false), []);

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
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-3xl border-white/10 px-4 pb-[calc(1rem+var(--safe-bottom))] pt-4 sm:mx-auto sm:max-w-lg">
          <SheetHeader className="pr-8 text-left">
            <SheetTitle className="flex items-center gap-2 font-display text-3xl tracking-wider"><TimerReset className="h-6 w-6 text-primary" /> TIMER</SheetTitle>
            <SheetDescription>Scegli liberamente la modalità. La scheda e le note del coach non vengono modificate.</SheetDescription>
          </SheetHeader>

          <div className="mt-4">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipo timer</span>
              <div className="relative">
                <select
                  value={config.mode}
                  onChange={(event) => setConfig((current) => ({ ...current, mode: event.target.value as WorkoutTimerMode }))}
                  className="h-12 w-full appearance-none rounded-xl border border-input bg-background px-3 pr-9 text-base font-semibold outline-none focus:ring-2 focus:ring-ring"
                >
                  {MODES.map((mode) => <option key={mode} value={mode}>{TIMER_MODE_LABELS[mode].title}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </label>
            <p className="mt-1.5 text-xs text-muted-foreground">{TIMER_MODE_LABELS[config.mode].description}</p>
          </div>

          <div className="mt-3">
            <TimerConfiguration config={config} onChange={setConfig} />
          </div>

          <button
            type="button"
            onClick={() => setConfig((current) => ({ ...current, silent: !current.silent }))}
            className="mt-3 flex w-full items-center justify-between rounded-xl border border-border bg-muted/20 px-3 py-2.5 text-left"
          >
            <span>
              <span className="block text-sm font-semibold">Segnali sonori e vibrazione</span>
            </span>
            {config.silent ? <VolumeX className="h-5 w-5 text-muted-foreground" /> : <Volume2 className="h-5 w-5 text-primary" />}
          </button>

          <Button onClick={launchTimer} className="mt-3 h-14 w-full rounded-2xl text-base font-bold">
            <Play className="mr-2 h-5 w-5 fill-current" /> Apri timer
          </Button>
        </SheetContent>
      </Sheet>

      {timerOpen && typeof document !== "undefined" && createPortal(
        <WorkoutTimerScreen config={config} exerciseName={exerciseName} exerciseNotes={exerciseNotes} onClose={closeTimer} onComplete={onComplete} />,
        document.body,
      )}
    </>
  );
}
