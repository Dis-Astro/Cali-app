import { describe, expect, it } from "vitest";
import { summarizeRoster } from "./courseRoster";

describe("coach participant counts", () => {
  it("separates pending from confirmed without double counting fixed members", () => {
    expect(summarizeRoster([
      { user_id: "a", status: "pending", booking_type: "fixed" },
      { user_id: "b", status: "confirmed", booking_type: "floating" },
      { user_id: "c", status: "cancelled", booking_type: "fixed" },
    ], ["a", "c", "d"], 8)).toEqual({
      reserved: 2, confirmed: 1, awaiting: 2, declined: 1, floating: 1, placesLeft: 6,
    });
  });
  it("never shows negative capacity and preserves unlimited sessions", () => {
    const bookings = [{ user_id: "a", status: "present", booking_type: "floating" }];
    expect(summarizeRoster(bookings, [], 0).placesLeft).toBe(0);
    expect(summarizeRoster(bookings, [], null).placesLeft).toBeNull();
  });
});
