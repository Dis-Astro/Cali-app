import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ClientCourseBooking from "./ClientCourseBooking";

const mocks = vi.hoisted(() => ({
  query: vi.fn(), rpc: vi.fn(), syncReminders: vi.fn(async () => undefined), toastError: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: vi.fn() } }));
vi.mock("@/features/course-booking/courseReminders", () => ({
  courseRemindersAvailable: () => false, courseRemindersEnabled: () => false,
  enableCourseReminders: vi.fn(), syncCourseReminders: mocks.syncReminders,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    const filters: Record<string, unknown> = {};
    const builder = {
      select: () => builder, eq: (key: string, value: unknown) => { filters[key] = value; return builder; },
      in: () => builder, gte: (key: string, value: unknown) => { filters[`gte:${key}`] = value; return builder; },
      lte: () => builder, order: () => builder,
      then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(mocks.query(table, filters)).then(resolve, reject),
    };
    return builder;
  },
  rpc: mocks.rpc,
  channel: () => { const channel = { on: () => channel, subscribe: () => channel }; return channel; },
  removeChannel: vi.fn(),
} }));

const session = { id: "session", course_id: "course", start_time: "2026-09-07T16:00:00Z", end_time: "2026-09-07T17:00:00Z", max_participants: 10, fixed_places: 6, floating_places: 4, confirmation_deadline_hours: 6, course: { name: "Corso Base", max_participants: 10, color: null } };
let booking = { id: "booking", course_session_id: "session", booking_type: "fixed", status: "pending" };
const resultFor = (table: string) => ({ data: {
  course_participants: [{ course_id: "course" }], course_sessions: [session], course_bookings: [booking],
  course_fixed_assignments: [{ course_id: "course", day_of_week: 1, start_time: "18:00:00" }],
}[table], error: null });

describe("client course responses", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-07T08:00:00Z"));
    vi.clearAllMocks();
    booking = { ...booking, status: "pending" };
    mocks.query.mockImplementation(resultFor);
    mocks.rpc.mockImplementation(async (name: string) => name === "get_course_session_availability"
      ? { data: [{ session_id: "session", booked: 10, fixed_booked: 6, floating_booked: 4 }], error: null }
      : { data: { ok: true }, error: null });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("offers an explicit response for pending seats, including a full session", async () => {
    render(<ClientCourseBooking userId="a" />);
    const confirm = await screen.findByRole("button", { name: "Partecipo" });
    expect(confirm).toBeEnabled();
    expect(screen.queryByText("Confermato")).not.toBeInTheDocument();
    expect(screen.getAllByText("Da confermare")).toHaveLength(2);
    expect(screen.getByText("lunedì 18:00")).toBeInTheDocument();
    fireEvent.click(confirm);
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("manage_course_booking", { p_session_id: "session", p_action: "confirm" }));
  });

  it.each(["course_participants", "course_sessions", "course_bookings", "course_fixed_assignments"])("shows an error, not empty or confirmed data, when %s fails", async (table) => {
    mocks.query.mockImplementation((name: string) => name === table ? { data: null, error: { message: "offline" } } : resultFor(name));
    render(<ClientCourseBooking userId="a" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Turni e disponibilità non verificati");
    expect(screen.queryByRole("button", { name: "Partecipo" })).not.toBeInTheDocument();
    expect(mocks.syncReminders).not.toHaveBeenCalled();
  });

  it("does not offer seats if availability cannot be verified", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
    render(<ClientCourseBooking userId="a" />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("ignores an old account's delayed response", async () => {
    let release!: (value: unknown) => void;
    mocks.query.mockImplementation((table: string, filters: Record<string, unknown>) => {
      if (table === "course_participants" && filters.user_id === "a") return new Promise((resolve) => { release = resolve; });
      if (table === "course_participants") return { data: [], error: null };
      return resultFor(table);
    });
    const view = render(<ClientCourseBooking userId="a" />);
    await waitFor(() => expect(release).toBeTypeOf("function"));
    view.rerender(<ClientCourseBooking userId="b" />);
    await waitFor(() => expect(mocks.syncReminders).toHaveBeenCalledWith([], [], [], "b"));
    await act(async () => { release(resultFor("course_participants")); });
    expect(screen.queryByText("Corso Base · posto fisso")).not.toBeInTheDocument();
    expect(mocks.query.mock.calls.filter(([table]) => table === "course_sessions")).toHaveLength(0);
  });

  it("refreshes the gym week and closes deadlines when the app returns to focus", async () => {
    vi.setSystemTime(new Date("2026-09-06T21:30:00Z"));
    render(<ClientCourseBooking userId="a" />);
    await screen.findByRole("button", { name: "Partecipo" });
    expect(mocks.query).toHaveBeenCalledWith("course_sessions", expect.objectContaining({ "gte:start_time": "2026-08-30T22:00:00.000Z" }));
    act(() => { vi.setSystemTime(new Date("2026-09-07T10:00:00Z")); fireEvent.focus(window); });
    await waitFor(() => expect(mocks.query).toHaveBeenCalledWith("course_sessions", expect.objectContaining({ "gte:start_time": "2026-09-06T22:00:00.000Z" })));
    expect(await screen.findByRole("button", { name: "Conferme chiuse" })).toBeDisabled();
  });

  it("clears the saving state and reloads after a network interruption", async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "manage_course_booking") throw new Error("network");
      return { data: [{ session_id: "session", booked: 1, fixed_booked: 1, floating_booked: 0 }], error: null };
    });
    render(<ClientCourseBooking userId="a" />);
    fireEvent.click(await screen.findByRole("button", { name: "Partecipo" }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining("Risposta non verificata")));
    expect(await screen.findByRole("button", { name: "Partecipo" })).toBeEnabled();
  });
});
