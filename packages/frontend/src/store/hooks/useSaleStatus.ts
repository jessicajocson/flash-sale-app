import { useCallback, useEffect, useRef, useState } from "react";
import { getSaleStatus } from "../../utils/requests/flash-sale.request";
import { POLL_INTERVAL_MS, TICK_INTERVAL_MS } from "../../constants";
import { isSaleStatusResponse } from "../../interfaces";
import type { SaleStatusResponse } from "../../interfaces";

interface SaleStatusState {
  data: SaleStatusResponse | null;
  timeRemainingMs: number;
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
}

export function useSaleStatus(): SaleStatusState {
  const [data, setData] = useState<SaleStatusResponse | null>(null);
  const [timeRemainingMs, setTimeRemainingMs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const lastFetchedAt = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const response = await getSaleStatus();
      if (!isSaleStatusResponse(response)) {
        // Wrong shape entirely (e.g. hit a route that fell back to the
        // SPA's own index.html instead of the API) - treat like a failed
        // fetch rather than rendering garbage.
        setError(true);
        return;
      }
      lastFetchedAt.current = Date.now();
      setData(response);
      setTimeRemainingMs(response.timeRemaining);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const pollId = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(pollId);
  }, [refresh]);

  useEffect(() => {
    const tickId = setInterval(() => {
      const elapsed = Date.now() - lastFetchedAt.current;
      setTimeRemainingMs((prev) => Math.max(0, (data?.timeRemaining ?? prev) - elapsed));
    }, TICK_INTERVAL_MS);
    return () => clearInterval(tickId);
  }, [data]);

  return { data, timeRemainingMs, loading, error, refresh };
}
