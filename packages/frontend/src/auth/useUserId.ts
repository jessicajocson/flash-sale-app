import { useEffect, useRef, useState } from "react";
import { getPurchaseStatus } from "../utils/requests/flash-sale.request";
import { EMAIL_PATTERN, USER_ID_PATTERN, USER_ID_STORAGE_KEY } from "../constants";

/**
 * Owns "who is this" for the purchase flow: the persisted userId and
 * whether that user has already secured an item (server-truth, checked
 * debounced while typing so a reload always reflects reality).
 */
export function useUserId() {
  const [userId, setUserId] = useState(() => localStorage.getItem(USER_ID_STORAGE_KEY) || "");
  const [hasPurchased, setHasPurchased] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const trimmedUserId = userId.trim();
  const isValidUserId = USER_ID_PATTERN.test(trimmedUserId) && EMAIL_PATTERN.test(trimmedUserId);

  useEffect(() => {
    if (trimmedUserId) {
      localStorage.setItem(USER_ID_STORAGE_KEY, trimmedUserId);
    } else {
      localStorage.removeItem(USER_ID_STORAGE_KEY);
    }

    if (!isValidUserId) {
      setHasPurchased(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await getPurchaseStatus(trimmedUserId);
        setHasPurchased(result.hasPurchased);
      } catch {
        // Non-fatal - the buy attempt itself is still authoritative.
      }
    }, 400);

    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedUserId, isValidUserId]);

  /**
   * Forgets the remembered identity - for "not you?" on a device someone
   * else already bought on, so the next person isn't stuck behind a
   * purchase that wasn't theirs.
   */
  function resetUserId() {
    localStorage.removeItem(USER_ID_STORAGE_KEY);
    setUserId("");
    setHasPurchased(false);
  }

  return {
    userId,
    setUserId,
    trimmedUserId,
    isValidUserId,
    hasPurchased,
    setHasPurchased,
    resetUserId,
  };
}
