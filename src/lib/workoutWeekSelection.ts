export function selectedWorkoutWeek(value: string | null, current: number, total: number) {
  const number = Number(value);
  return value && /^\d+$/.test(value) && number >= 1 && number <= Math.min(current, total) ? number : current;
}
