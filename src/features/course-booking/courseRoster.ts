type Booking = { user_id: string; status: string; booking_type: string };

export function summarizeRoster(bookings: Booking[], fixedUserIds: string[], capacity: number | null | undefined) {
  const reserved = bookings.filter((booking) => ["pending", "confirmed", "present"].includes(booking.status));
  const confirmed = bookings.filter((booking) => ["confirmed", "present"].includes(booking.status));
  const awaiting = new Set([
    ...bookings.filter((booking) => booking.status === "pending").map((booking) => booking.user_id),
    ...fixedUserIds.filter((id) => !bookings.some((booking) => booking.user_id === id)),
  ]);
  return {
    reserved: reserved.length,
    confirmed: confirmed.length,
    awaiting: awaiting.size,
    declined: bookings.filter((booking) => ["cancelled", "absent"].includes(booking.status)).length,
    floating: reserved.filter((booking) => booking.booking_type !== "fixed").length,
    placesLeft: capacity == null ? null : Math.max(0, capacity - reserved.length),
  };
}
