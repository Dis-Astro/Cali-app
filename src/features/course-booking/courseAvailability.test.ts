import { describe, expect, it } from "vitest";
import { bookingStatusLabels, placesForClient } from "./courseAvailability";

const session = { max_participants: 10, fixed_places: 6, floating_places: 4, course: null };
describe("client course availability", () => {
  it("does not label a pending booking as confirmed", () => {
    expect(bookingStatusLabels.pending).toBe("Da confermare");
    expect(bookingStatusLabels.confirmed).toBe("Confermato");
  });
  it("limits occasional seats even if fixed seats are unoccupied", () => {
    const counts = { booked: 4, fixed_booked: 0, floating_booked: 4 };
    expect(placesForClient(session, counts, false)).toBe(0);
    expect(placesForClient(session, counts, true)).toBe(6);
  });
  it("allows confirming an already reserved pending seat at capacity", () => {
    const counts = { booked: 10, fixed_booked: 6, floating_booked: 4 };
    expect(placesForClient(session, counts, true, { status: "pending", booking_type: "fixed" })).toBe(1);
    expect(placesForClient(session, counts, false, { status: "pending", booking_type: "floating" })).toBe(1);
    expect(placesForClient(session, counts, false, { status: "cancelled", booking_type: "floating" })).toBe(0);
  });
  it("uses the server fallback for category capacity and fails closed for missing counts", () => {
    expect(placesForClient({ ...session, floating_places: null }, { booked: 3, fixed_booked: 0, floating_booked: 3 }, false)).toBe(1);
    expect(placesForClient(session, undefined, false)).toBeUndefined();
  });
  it("does not subtract a former fixed booking from the occasional category", () => {
    expect(placesForClient(session, { booked: 10, fixed_booked: 6, floating_booked: 4 }, false, { status: "pending", booking_type: "fixed" })).toBe(0);
  });
});
