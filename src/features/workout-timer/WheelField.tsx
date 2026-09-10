import { useEffect, useId, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatTimerTime } from "./timerModel";

const ROW = 40;
function WheelColumn({ label, values, value, onChange }: { label: string; values: number[]; value: number; onChange: (n: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const initialIndex = useRef(Math.max(0, values.indexOf(value)));
  useEffect(() => { if (ref.current) ref.current.scrollTop = initialIndex.current * ROW; }, []);
  const select = (index: number) => {
    const safe = Math.max(0, Math.min(values.length - 1, index));
    if (ref.current) ref.current.scrollTop = safe * ROW;
    onChange(values[safe]);
  };
  return <div className="min-w-0 flex-1">
    <p className="mb-2 text-center text-xs text-white/60">{label}</p>
    <div ref={ref} role="listbox" tabIndex={0} aria-label={label} aria-activedescendant={`${id}-${value}`}
      className="timer-wheel" onScroll={(event) => {
        const index = Math.max(0, Math.min(values.length - 1, Math.round(event.currentTarget.scrollTop / ROW)));
        onChange(values[index]);
      }} onKeyDown={(event) => {
        const index = values.indexOf(value);
        if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          select(event.key === "Home" ? 0 : event.key === "End" ? values.length - 1 : index + (event.key === "ArrowDown" ? 1 : -1));
        }
      }}>
      {values.map((n, index) => <div key={n} id={`${id}-${n}`} role="option" aria-selected={value === n}
        className={`timer-wheel-item ${value === n ? "bg-white/10 font-bold text-white" : "text-white/45"}`}
        onClick={() => select(index)}>{String(n).padStart(2, "0")}</div>)}
    </div>
  </div>;
}
export function WheelField({ label, value, onChange, kind = "time", allowZero = false, max = 180, zeroLabel = "—" }: {
  label: string; value: number; onChange: (n: number) => void; kind?: "time" | "count"; allowZero?: boolean; max?: number; zeroLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const values = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, n) => n + from);
  return <>
    <button type="button" className="timer-value-field" aria-label={`${label}: ${kind === "time" ? formatTimerTime(value * 1000) : value}`}
      onClick={() => { setDraft(value); setOpen(true); }}>
      <span className="text-xs text-white/65">{label}</span>
      <strong className="text-2xl font-semibold tabular-nums">{value === 0 ? zeroLabel : kind === "time" ? formatTimerTime(value * 1000) : value}</strong>
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="z-[220] max-w-[320px] border-white/20 bg-neutral-950 text-white">
        <DialogTitle>{label}</DialogTitle>
        <DialogDescription>Scorri per scegliere, poi conferma.</DialogDescription>
        <div className="flex gap-4">
          {kind === "count" ? <WheelColumn label={label} values={values(allowZero ? 0 : 1, max)} value={draft} onChange={setDraft} /> : <>
            <WheelColumn label="Minuti" values={values(0, max)} value={Math.floor(draft / 60)} onChange={(n) => setDraft((old) => n * 60 + old % 60)} />
            <WheelColumn label="Secondi" values={values(0, 59)} value={draft % 60} onChange={(n) => setDraft((old) => Math.floor(old / 60) * 60 + n)} />
          </>}
        </div>
        <button className="h-12 rounded-full bg-white font-bold text-black" onClick={() => { onChange(Math.max(allowZero ? 0 : 1, draft)); setOpen(false); }}>OK</button>
      </DialogContent>
    </Dialog>
  </>;
}
