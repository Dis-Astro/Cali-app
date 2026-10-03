import { Button } from "@/components/ui/button";

export default function WorkoutWeekSelector({ currentWeek, totalWeeks, selectedWeek, automatic, onSelect }: {
  currentWeek: number; totalWeeks: number; selectedWeek: number; automatic: boolean;
  onSelect: (week: number | null) => void;
}) {
  return <section className="space-y-2 rounded-2xl border bg-card p-3" aria-label="Settimana da compilare">
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm font-semibold">Settimana da compilare: {selectedWeek}</p>
      <Button size="sm" variant={automatic ? "default" : "outline"} aria-pressed={automatic} onClick={() => onSelect(null)}>Automatica · {currentWeek}</Button>
    </div>
    <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Scegli settimana">
      {Array.from({ length: totalWeeks }, (_, index) => index + 1).map((week) => <Button key={week} className="h-10 min-w-10 shrink-0 px-2" variant={selectedWeek === week ? "default" : "outline"}
        aria-label={`Settimana ${week}`} aria-pressed={selectedWeek === week} disabled={week > currentWeek} onClick={() => onSelect(week)}>{week}</Button>)}
    </div>
    <p className="text-xs text-muted-foreground">{automatic ? "Segue il calendario della scheda. Scegli un numero per recuperare una settimana passata." : `Stai compilando solo la settimana ${selectedWeek}. La scelta resta attiva finché non premi Automatica.`}</p>
  </section>;
}
