import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import OfflineWorkoutDayDetail from "./OfflineWorkoutDayDetail";
const mocks = vi.hoisted(() => ({ queue: vi.fn(async () => ({ synced: false })) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ profile: { user_id: "owner" } }) }));
vi.mock("@/lib/offlineWorkout", async (original) => ({ ...await original<typeof import("@/lib/offlineWorkout")>(), calculateCurrentWeek: () => 4, calculateTotalWeeks: () => 6 }));
vi.mock("@/lib/offlineSync", () => ({
  getPendingWorkoutCompletions: async () => [], setOfflineCache: async () => undefined,
  queueWorkoutCompletion: mocks.queue,
  getOfflineCache: async () => ({ value: {
    plan: { id: "plan", name: "Scheda", start_date: "2026-09-01", end_date: "2026-10-13" },
    exercises: [{ id: "exercise", exercise_name: "Squat", notes: null, video: null,
      weekCompletions: Array.from({ length: 6 }, (_, i) => ({ week_number: i + 1, client_notes: `Nota ${i + 1}`, difficulty_rating: 0, saved: false })) }],
  } }),
}));
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });
describe("selected workout week", () => {
  it("shows and saves only the selected past week and retains drafts when switching", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(<MemoryRouter initialEntries={["/coaching/scheda/2?week=3"]}><Routes><Route path="/coaching/scheda/:dayId" element={<OfflineWorkoutDayDetail />} /></Routes></MemoryRouter>);
    fireEvent.click(await screen.findByTestId("exercise-toggle"));
    expect(screen.getByText("SETTIMANA 3")).toBeInTheDocument();
    expect(screen.queryByText("SETTIMANA 4")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Allenamento venerdì" } });
    fireEvent.click(screen.getByRole("button", { name: "Settimana 2" }));
    expect(screen.getByRole("textbox")).toHaveValue("Nota 2");
    fireEvent.click(screen.getByRole("button", { name: "Settimana 3" }));
    expect(screen.getByRole("textbox")).toHaveValue("Allenamento venerdì");
    fireEvent.click(screen.getByRole("button", { name: "Salva valutazione" }));
    await waitFor(() => expect(mocks.queue).toHaveBeenCalledWith(expect.objectContaining({ clientId: "owner", workoutPlanExerciseId: "exercise", weekNumber: 3, clientNotes: "Allenamento venerdì" })));
    fireEvent.click(screen.getByRole("button", { name: "Automatica · 4" }));
    expect(screen.getByText("SETTIMANA 4")).toBeInTheDocument();
    expect(screen.queryByText("SETTIMANA 3")).not.toBeInTheDocument();
  });
});
