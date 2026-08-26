import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useUserId } from "./useUserId";
import { USER_ID_STORAGE_KEY } from "../constants";
import * as flashSaleRequests from "../utils/requests/flash-sale.request";

vi.mock("../utils/requests/flash-sale.request");

describe("useUserId", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(flashSaleRequests.getPurchaseStatus).mockReset();
  });

  it("starts empty when nothing is saved", () => {
    const { result } = renderHook(() => useUserId());
    expect(result.current.userId).toBe("");
    expect(result.current.isValidUserId).toBe(false);
    expect(result.current.hasPurchased).toBe(false);
  });

  it("restores a previously saved userId from localStorage", () => {
    localStorage.setItem(USER_ID_STORAGE_KEY, "jane@example.com");
    const { result } = renderHook(() => useUserId());
    expect(result.current.userId).toBe("jane@example.com");
    expect(result.current.isValidUserId).toBe(true);
  });

  it("rejects userIds with disallowed characters", () => {
    const { result } = renderHook(() => useUserId());
    act(() => result.current.setUserId("not valid!"));
    expect(result.current.isValidUserId).toBe(false);
  });

  it("checks purchase-status (debounced) once a valid userId is entered, and persists it", async () => {
    vi.mocked(flashSaleRequests.getPurchaseStatus).mockResolvedValue({
      userId: "jane@example.com",
      hasPurchased: true,
      timestamp: new Date().toISOString(),
    });

    const { result } = renderHook(() => useUserId());
    act(() => result.current.setUserId("jane@example.com"));

    await waitFor(() => expect(result.current.hasPurchased).toBe(true));

    expect(flashSaleRequests.getPurchaseStatus).toHaveBeenCalledWith("jane@example.com");
    expect(localStorage.getItem(USER_ID_STORAGE_KEY)).toBe("jane@example.com");
  });

  it("resets hasPurchased once the userId becomes invalid again", async () => {
    vi.mocked(flashSaleRequests.getPurchaseStatus).mockResolvedValue({
      userId: "jane@example.com",
      hasPurchased: true,
      timestamp: new Date().toISOString(),
    });

    const { result } = renderHook(() => useUserId());
    act(() => result.current.setUserId("jane@example.com"));
    await waitFor(() => expect(result.current.hasPurchased).toBe(true));

    act(() => result.current.setUserId(""));
    expect(result.current.hasPurchased).toBe(false);
  });

  it("resetUserId forgets the remembered identity, including in localStorage", async () => {
    vi.mocked(flashSaleRequests.getPurchaseStatus).mockResolvedValue({
      userId: "jane@example.com",
      hasPurchased: true,
      timestamp: new Date().toISOString(),
    });

    const { result } = renderHook(() => useUserId());
    act(() => result.current.setUserId("jane@example.com"));
    await waitFor(() => expect(result.current.hasPurchased).toBe(true));

    act(() => result.current.resetUserId());

    expect(result.current.userId).toBe("");
    expect(result.current.hasPurchased).toBe(false);
    expect(localStorage.getItem(USER_ID_STORAGE_KEY)).toBeNull();
  });
});
