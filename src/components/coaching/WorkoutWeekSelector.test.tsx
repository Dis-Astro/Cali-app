import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorkoutWeekSelector from "./WorkoutWeekSelector";
import { selectedWorkoutWeek } from "@/lib/workoutWeekSelection";
afterEach(cleanup);
describe("workout week selection", () => {
  it("holds week 3 through the calendar rollover and resumes automatic progression", () => {
    expect(selectedWorkoutWeek("3", 3, 6)).toBe(3);
    expect(selectedWorkoutWeek("3", 4, 6)).toBe(3);
    expect(selectedWorkoutWeek(null, 4, 6)).toBe(4);
    for (const value of ["0", "7", "-1", "3.5", "invalid"]) expect(selectedWorkoutWeek(value, 4, 6)).toBe(4);
  });
  it("allows past weeks, marks the chosen week, and keeps future weeks unavailable", () => {
    const select = vi.fn();
    render(<WorkoutWeekSelector currentWeek={4} totalWeeks={6} selectedWeek={3} automatic={false} onSelect={select} />);
    expect(screen.getByRole("button", { name: "Settimana 3" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Settimana 5" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Settimana 2" }));
    expect(select).toHaveBeenLastCalledWith(2);
    fireEvent.click(screen.getByRole("button", { name: "Automatica · 4" }));
    expect(select).toHaveBeenLastCalledWith(null);
  });
});
