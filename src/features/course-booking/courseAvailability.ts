export const activeBookingStatuses = new Set(["pending", "confirmed", "present"]);
export const bookingStatusLabels: Record<string, string> = {
  pending: "Da confermare", confirmed: "Confermato", present: "Presente", cancelled: "Rinuncia registrata", absent: "Assenza registrata",
};

/** Mirrors the existing server's total + category limits; the RPC remains authoritative. */
export function placesForClient(
  session: { max_participants: number | null; fixed_places: number; floating_places: number | null; course: { max_participants: number | null } | null },
  counts: { booked: number; fixed_booked: number; floating_booked: number } | undefined,
  fixed: boolean,
  booking?: { status: string; booking_type: string },
) {
  if (!counts) return undefined;
  const totalCapacity = session.max_participants ?? session.course?.max_participants ?? Infinity;
  const categoryCapacity = fixed ? session.fixed_places : (session.floating_places ?? Math.max(0, totalCapacity - session.fixed_places));
  const ownActive = Boolean(booking && activeBookingStatuses.has(booking.status));
  const ownCategory = ownActive && (fixed ? booking?.booking_type === "fixed" : booking?.booking_type !== "fixed");
  const totalLeft = totalCapacity - Number(counts.booked) + Number(ownActive);
  const categoryLeft = categoryCapacity - Number(fixed ? counts.fixed_booked : counts.floating_booked) + Number(ownCategory);
  const remaining = Math.max(0, Math.min(totalLeft, categoryLeft));
  return Number.isFinite(remaining) ? remaining : null;
}
