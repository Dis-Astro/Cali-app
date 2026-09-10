import { useState } from "react";
import { ArrowDown, ArrowUp, Copy, Plus, X } from "lucide-react";
import { WheelField } from "./WheelField";
import { DEFAULT_TIMER_CONFIG, TIMER_MODE_LABELS, type MixBlock, type WorkoutTimerConfig } from "./types";

function RepeatedSets({ config, onChange }: { config: WorkoutTimerConfig; onChange: (config: WorkoutTimerConfig) => void }) {
  return (config.sets ?? 1) === 1 ? <button className="timer-add" onClick={() => onChange({ ...config, sets: 3, setRestSeconds: 120 })}>＋ Aggiungi set (opzionale)</button> :
    <div className="relative rounded-2xl border border-white/20 p-3 pt-9">
      <button className="absolute right-2 top-1 flex h-8 w-8 items-center justify-center" aria-label="Rimuovi set aggiuntivi" onClick={() => onChange({ ...config, sets: 1 })}><X size={18}/></button>
      <div className="grid grid-cols-2 gap-2">
        <WheelField label="Set" kind="count" max={20} value={config.sets ?? 1} onChange={(sets) => onChange({ ...config, sets })}/>
        <WheelField label="Riposo tra set" allowZero value={config.setRestSeconds ?? 120} onChange={(setRestSeconds) => onChange({ ...config, setRestSeconds })}/>
      </div>
    </div>;
}

function MixEditor({ config, onChange }: { config: WorkoutTimerConfig; onChange: (config: WorkoutTimerConfig) => void }) {
  const [kind, setKind] = useState<MixBlock["kind"]>("amrap");
  const blocks = config.mixBlocks ?? [];
  const update = (index: number, patch: Partial<MixBlock>) => onChange({ ...config, mixBlocks: blocks.map((block, i) => i === index ? { ...block, ...patch } : block) });
  const add = (type: MixBlock["kind"]) => {
    if (blocks.length >= 20) return;
    onChange({ ...config, mixBlocks: [...blocks, { id: crypto.randomUUID(), label: "", kind: type, durationSeconds: type === "amrap" ? 600 : 60,
      intervalSeconds: 60, workSeconds: 20, restSeconds: 10, rounds: 8, repeats: 1 }] });
  };
  const move = (index: number, delta: number) => {
    const reordered = [...blocks];
    [reordered[index], reordered[index + delta]] = [reordered[index + delta], reordered[index]];
    onChange({ ...config, mixBlocks: reordered });
  };
  return <div className="space-y-3">
    {blocks.map((block, index) => <details key={block.id} className="rounded-xl border border-white/20 p-3" open={undefined}>
      <summary className="cursor-pointer font-semibold">{index + 1}. {block.label || (block.kind === "work" ? "Lavoro" : block.kind === "rest" ? "Riposo" : TIMER_MODE_LABELS[block.kind].title)} {block.repeats > 1 && `× ${block.repeats}`}</summary>
      <label className="mt-3 block text-xs">Nome blocco<input className="mt-1 h-11 w-full rounded-lg bg-white/10 px-3 text-base" maxLength={80} value={block.label} onChange={(e) => update(index, { label: e.target.value })}/></label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {block.kind === "tabata" ? <>
          <WheelField label="Serie" kind="count" max={50} value={block.rounds} onChange={(rounds) => update(index, { rounds })}/>
          <WheelField label="Lavoro" max={30} value={block.workSeconds} onChange={(workSeconds) => update(index, { workSeconds })}/>
          <WheelField label="Riposo" max={30} value={block.restSeconds} allowZero onChange={(restSeconds) => update(index, { restSeconds })}/>
        </> : <WheelField label={block.kind === "stopwatch" ? "Tempo massimo" : "Durata"} value={block.durationSeconds} onChange={(durationSeconds) => update(index, { durationSeconds })}/>}
        {block.kind === "emom" && <WheelField label="Ogni" value={block.intervalSeconds} max={30} onChange={(intervalSeconds) => update(index, { intervalSeconds })}/>}
        <WheelField label="Ripeti blocco" kind="count" max={10} value={block.repeats} onChange={(repeats) => update(index, { repeats })}/>
      </div>
      <div className="mt-3 flex justify-end gap-3">
        <button aria-label={`Sposta su blocco ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp/></button>
        <button aria-label={`Sposta giù blocco ${index + 1}`} disabled={index === blocks.length - 1} onClick={() => move(index, 1)}><ArrowDown/></button>
        <button aria-label={`Duplica blocco ${index + 1}`} disabled={blocks.length >= 20} onClick={() => onChange({ ...config, mixBlocks: [...blocks.slice(0, index + 1), { ...block, id: crypto.randomUUID() }, ...blocks.slice(index + 1)] })}><Copy/></button>
        <button aria-label={`Elimina blocco ${index + 1}`} onClick={() => onChange({ ...config, mixBlocks: blocks.filter((_, i) => i !== index) })}><X/></button>
      </div>
    </details>)}
    <div className="grid grid-cols-2 gap-2">
      <select className="h-11 rounded-lg bg-neutral-900 px-2" aria-label="Tipo di workout MIX" value={kind} onChange={(e) => setKind(e.target.value as MixBlock["kind"])}>
        {(["amrap", "stopwatch", "emom", "tabata"] as const).map((mode) => <option value={mode} key={mode}>{TIMER_MODE_LABELS[mode].title}</option>)}
      </select>
      <button className="timer-add" disabled={blocks.length >= 20} onClick={() => add(kind)}>＋ Tipo di workout</button>
      <button className="timer-add" disabled={blocks.length >= 20} onClick={() => add("work")}>＋ Lavoro</button>
      <button className="timer-add" disabled={blocks.length >= 20} onClick={() => add("rest")}>＋ Riposo</button>
    </div>
    <WheelField label="Ripeti sequenza" kind="count" max={20} value={config.sets ?? 1} onChange={(sets) => onChange({ ...config, sets })}/>
  </div>;
}

export function TimerConfiguration({ config, onChange }: { config: WorkoutTimerConfig; onChange: (config: WorkoutTimerConfig) => void }) {
  if (config.mode === "mix") return <MixEditor config={config} onChange={onChange}/>;
  if (config.mode === "countdown") return <WheelField label="Durata" value={config.durationSeconds} onChange={(durationSeconds) => onChange({ ...config, durationSeconds })}/>;
  if (config.mode === "amrap") {
    const sets = config.amrapSets?.length ? config.amrapSets : [{ durationSeconds: config.durationSeconds, restSeconds: 120 }];
    return <div className="space-y-4">
      <p className="text-center text-sm text-white/75">Il maggior numero possibile di serie nel tempo scelto</p>
      {sets.length > 1 && <h3 className="text-center text-2xl font-bold">{sets.length} × AMRAP</h3>}
      {sets.map((set, index) => <div key={index} className="relative rounded-xl border border-white/15 p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-white/60"><span>AMRAP {index + 1}</span>
          {sets.length > 1 && <button className="h-8 w-8" aria-label={`Elimina AMRAP ${index + 1}`} onClick={() => onChange({ ...config, amrapSets: sets.filter((_, i) => i !== index) })}><X size={18}/></button>}
        </div>
        <div className={`grid gap-2 ${index < sets.length - 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          <WheelField label={`Durata AMRAP ${index + 1}`} value={set.durationSeconds} onChange={(durationSeconds) => onChange({ ...config, durationSeconds: index === 0 ? durationSeconds : config.durationSeconds, amrapSets: sets.map((s, i) => i === index ? { ...s, durationSeconds } : s) })}/>
          {index < sets.length - 1 && <WheelField label={`Riposo dopo AMRAP ${index + 1}`} value={set.restSeconds} allowZero onChange={(restSeconds) => onChange({ ...config, amrapSets: sets.map((s, i) => i === index ? { ...s, restSeconds } : s) })}/>}
        </div>
      </div>)}
      <button disabled={sets.length >= 20} className="timer-add w-full" onClick={() => onChange({ ...config, amrapSets: [...sets, { durationSeconds: config.durationSeconds, restSeconds: 120 }] })}><Plus size={18}/> {sets.length === 1 ? "Aggiungi più AMRAP (opzionale)" : "Aggiungi un altro AMRAP"}</button>
      {config.showAmrapReps ? <div className="flex items-center gap-2">
        <WheelField label="Ripetizioni per serie" kind="count" max={200} value={config.amrapReps} onChange={(amrapReps) => onChange({ ...config, amrapReps })}/>
        <button className="timer-icon" aria-label="Nascondi obiettivo ripetizioni" onClick={() => onChange({ ...config, showAmrapReps: false })}><X size={18}/></button>
      </div> : <button className="timer-add w-full" onClick={() => onChange({ ...config, showAmrapReps: true })}>＋ Obiettivo ripetizioni (opzionale)</button>}
    </div>;
  }
  return <div className="space-y-4">
    {config.mode === "stopwatch" && <>
      <WheelField label="Tempo massimo" value={config.forTimeCapSeconds ?? 0} allowZero zeroLabel="Nessuno" onChange={(forTimeCapSeconds) => onChange({ ...config, forTimeCapSeconds })}/>
      <RepeatedSets config={config} onChange={onChange}/>
      {(config.signalSeconds ?? 0) === 0 ? <button className="timer-add" onClick={() => onChange({ ...config, signalSeconds: 60 })}>＋ Segnale a intervalli (opzionale)</button> : <div className="flex items-center gap-3">
        <WheelField label="Segnale ogni" value={config.signalSeconds!} onChange={(signalSeconds) => onChange({ ...config, signalSeconds })}/>
        <button aria-label="Rimuovi segnale a intervalli" onClick={() => onChange({ ...config, signalSeconds: 0 })}><X/></button>
      </div>}
    </>}
    {config.mode === "emom" && <>
      <div className="grid grid-cols-2 gap-2">
        <WheelField label="Ogni" max={30} value={config.intervalSeconds} onChange={(intervalSeconds) => onChange({ ...config, intervalSeconds })}/>
        {!config.emomOpenEnded && <WheelField label="Per" value={config.emomDurationSeconds ?? config.intervalSeconds * config.rounds} onChange={(emomDurationSeconds) => onChange({ ...config, emomDurationSeconds })}/>}
      </div>
      {!config.emomOpenEnded && <RepeatedSets config={config} onChange={onChange}/>}
      <button className="timer-add" aria-pressed={config.emomOpenEnded} onClick={() => onChange({ ...config, emomOpenEnded: !config.emomOpenEnded })}>∞ Il più a lungo possibile (Death By) {config.emomOpenEnded ? "✓" : ""}</button>
    </>}
    {config.mode === "tabata" && <>
      <WheelField label="Serie" kind="count" max={100} value={config.rounds} onChange={(rounds) => onChange({ ...config, rounds })}/>
      <div className="grid grid-cols-2 gap-2">
        <WheelField label="Lavoro" max={30} value={config.workSeconds} onChange={(workSeconds) => onChange({ ...config, workSeconds })}/>
        <WheelField label="Riposo" max={30} allowZero value={config.restSeconds} onChange={(restSeconds) => onChange({ ...config, restSeconds })}/>
      </div>
      <RepeatedSets config={config} onChange={onChange}/>
    </>}
  </div>;
}
