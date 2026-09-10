import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CourseRosterManagement from "./CourseRosterManagement";

const mocks = vi.hoisted(() => ({ query: vi.fn(), toastError: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    const filters: Record<string, unknown> = {};
    const builder = {
      select: () => builder, eq: (key: string, value: unknown) => { filters[key] = value; return builder; },
      in: () => builder, gte: () => builder, lte: () => builder, order: () => builder,
      limit: (value: number) => { filters.limit = value; return builder; },
      insert: () => { filters.action = "insert"; return builder; },
      update: () => { filters.action = "update"; return builder; },
      delete: () => { filters.action = "delete"; return builder; },
      then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(mocks.query(table, filters)).then(resolve, reject),
    };
    return builder;
  },
  channel: () => { const channel = { on: () => channel, subscribe: () => channel }; return channel; },
  removeChannel: vi.fn(),
} }));

const session = { id: "session", course_id: "course", start_time: "2026-09-07T16:00:00Z", end_time: "2026-09-07T17:00:00Z", max_participants: 10, fixed_places: 6, floating_places: null, confirmation_deadline_hours: 6, course: { name: "Corso Base", max_participants: 10, color: null } };
const resultFor = (table: string) => ({ data: {
  courses: [{ id: "course" }], course_participants: [{ course_id: "course", user_id: "a" }], course_sessions: [session],
  course_bookings: [{ id: "booking", course_session_id: "session", user_id: "a", booking_type: "fixed", status: "pending" }],
  course_fixed_assignments: [{ course_id: "course", user_id: "a", day_of_week: 1, start_time: "18:00:00" }],
  profiles: [{ user_id: "a", first_name: "Mario", last_name: "Rossi" }],
}[table], error: null });

describe("coach course roster", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-07T08:00:00Z"));
    vi.clearAllMocks();
    mocks.query.mockImplementation(resultFor);
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("separates pending/confirmed counts and shows gym time, deadline and fallback quota", async () => {
    render(<CourseRosterManagement coachId="coach" />);
    expect(await screen.findByText("Confermati / presenti 0/10")).toBeInTheDocument();
    expect(screen.getByText("Da confermare 1")).toBeInTheDocument();
    expect(screen.getByText(/lunedì 7 settembre.*18:00/)).toBeInTheDocument();
    expect(screen.getByText("Risposte clienti entro lunedì 12:00")).toBeInTheDocument();
    expect(screen.getByText("0/4")).toBeInTheDocument();
  });

  it.each(["courses", "course_sessions", "course_bookings", "course_fixed_assignments", "course_participants", "profiles"])("hides incomplete counts and controls when %s fails", async (table) => {
    mocks.query.mockImplementation((name: string) => name === table ? { data: null, error: { message: "offline" } } : resultFor(name));
    render(<CourseRosterManagement coachId="coach" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Presenze non disponibili");
    expect(screen.queryByText("Confermati / presenti 0/10")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("exposes a load-more control instead of silently hiding the twenty-fifth session", async () => {
    mocks.query.mockImplementation((table: string, filters: Record<string, unknown>) => table === "course_sessions"
      ? { data: Array.from({ length: 25 }, (_, index) => ({ ...session, id: `session-${index}` })).slice(0, Number(filters.limit)), error: null }
      : resultFor(table));
    render(<CourseRosterManagement coachId="coach" />);
    const more = await screen.findByRole("button", { name: "Mostra altri turni (24 visualizzati)" });
    expect(screen.getAllByText("Corso Base")).toHaveLength(24);
    fireEvent.click(more);
    await waitFor(() => expect(screen.getAllByText("Corso Base")).toHaveLength(25));
    expect(screen.queryByRole("button", { name: /Mostra altri turni/ })).not.toBeInTheDocument();
  });

  it("does not restore an earlier coach's delayed courses", async () => {
    let release!: (value: unknown) => void;
    mocks.query.mockImplementation((table: string, filters: Record<string, unknown>) => {
      if (table === "courses" && filters.coach_id === "old") return new Promise((resolve) => { release = resolve; });
      if (table === "courses") return { data: [], error: null };
      return resultFor(table);
    });
    const view = render(<CourseRosterManagement coachId="old" />);
    await waitFor(() => expect(release).toBeTypeOf("function"));
    view.rerender(<CourseRosterManagement coachId="new" />);
    expect(await screen.findByText("Nessun turno programmato.")).toBeInTheDocument();
    await act(async () => { release(resultFor("courses")); });
    expect(screen.queryByText("Corso Base")).not.toBeInTheDocument();
  });

  it("releases controls and reloads after an interrupted assignment write", async () => {
    mocks.query.mockImplementation((table: string, filters: Record<string, unknown>) => {
      if (filters.action) throw new Error("network");
      return resultFor(table);
    });
    render(<CourseRosterManagement coachId="coach" />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Rendi occasionale" }))[0]);
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining("Esito non verificato")));
    expect((await screen.findAllByRole("button", { name: "Rendi occasionale" }))[0]).toBeEnabled();
  });
});
