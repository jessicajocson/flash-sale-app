export type SaleWindowStatus = "upcoming" | "active" | "ended";

export interface SaleWindow {
  status: SaleWindowStatus;
  /** Milliseconds until the next transition (start if upcoming, end if active, 0 if ended) */
  timeRemaining: number;
}

/**
 * Pure tri-state sale window calculation, kept separate from the route
 * handler so it can be unit tested directly without booting the app or
 * mutating the process-wide config singleton.
 */
export function getSaleWindow(now: Date, start: Date, end: Date): SaleWindow {
  if (now < start) {
    return { status: "upcoming", timeRemaining: start.getTime() - now.getTime() };
  }

  if (now < end) {
    return { status: "active", timeRemaining: end.getTime() - now.getTime() };
  }

  return { status: "ended", timeRemaining: 0 };
}
