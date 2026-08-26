import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PurchaseModal from "./PurchaseModal";
import { useUserId } from "../auth/useUserId";
import * as flashSaleRequests from "../utils/requests/flash-sale.request";

vi.mock("../utils/requests/flash-sale.request");

const Wrapper = ({
  onPurchased = vi.fn(),
  onClose = vi.fn(),
}: {
  onPurchased?: () => void;
  onClose?: () => void;
}) => {
  const userIdState = useUserId();
  return (
    <PurchaseModal
      itemName="Limited Edition Item"
      price="$99.99"
      userIdState={userIdState}
      onClose={onClose}
      onPurchased={onPurchased}
    />
  );
};

describe("PurchaseModal", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(flashSaleRequests.getPurchaseStatus).mockResolvedValue({
      userId: "buyer@example.com",
      hasPurchased: false,
      timestamp: new Date().toISOString(),
    });
  });

  it("rejects submit when the field is empty", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    await user.click(screen.getByRole("button", { name: /confirm purchase/i }));
    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(flashSaleRequests.fetchCsrfToken).not.toHaveBeenCalled();
  });

  it("rejects a value that isn't a well-formed email, without calling the API", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    await user.type(screen.getByLabelText(/email address/i), "not-an-email");
    await user.click(screen.getByRole("button", { name: /confirm purchase/i }));

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(flashSaleRequests.fetchCsrfToken).not.toHaveBeenCalled();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Wrapper onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("buys successfully: fetches a CSRF token, submits, and shows the confirmation state", async () => {
    const user = userEvent.setup();
    vi.mocked(flashSaleRequests.fetchCsrfToken).mockResolvedValue({
      token: "a".repeat(32),
      expiresAt: new Date().toISOString(),
    });
    vi.mocked(flashSaleRequests.submitPurchase).mockResolvedValue({
      success: true,
      message: "Purchase successful",
      correlationId: "corr-1",
      timestamp: new Date().toISOString(),
      data: { purchaseId: "p1", userId: "buyer@example.com", itemId: "1" },
    });
    const onPurchased = vi.fn();

    render(<Wrapper onPurchased={onPurchased} />);

    await user.type(screen.getByLabelText(/email address/i), "buyer@example.com");
    await user.click(screen.getByRole("button", { name: /confirm purchase/i }));

    expect(await screen.findByText("Purchase successful!")).toBeInTheDocument();
    expect(screen.getByText("Purchase successful")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^okay$/i })).toBeInTheDocument();
    expect(flashSaleRequests.submitPurchase).toHaveBeenCalledWith("buyer@example.com", "a".repeat(32));
    expect(onPurchased).toHaveBeenCalled();
  });

  it("shows a friendly message when the user already purchased", async () => {
    const user = userEvent.setup();
    vi.mocked(flashSaleRequests.fetchCsrfToken).mockResolvedValue({
      token: "a".repeat(32),
      expiresAt: new Date().toISOString(),
    });
    vi.mocked(flashSaleRequests.submitPurchase).mockRejectedValue({
      response: {
        data: {
          errorCode: "PURCHASE_FAILED",
          message: "You have already purchased this item",
          correlationId: "corr-2",
          timestamp: new Date().toISOString(),
          statusCode: 400,
        },
      },
    });

    render(<Wrapper />);

    await user.type(screen.getByLabelText(/email address/i), "buyer@example.com");
    await user.click(screen.getByRole("button", { name: /confirm purchase/i }));

    expect(await screen.findByText(/already secured this item/i)).toBeInTheDocument();
    expect(screen.getByText("You're in!")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^okay$/i })).toBeInTheDocument();
  });

  it("auto-closes the confirmation 10 seconds after a successful purchase", async () => {
    const user = userEvent.setup();
    vi.mocked(flashSaleRequests.fetchCsrfToken).mockResolvedValue({
      token: "a".repeat(32),
      expiresAt: new Date().toISOString(),
    });
    vi.mocked(flashSaleRequests.submitPurchase).mockResolvedValue({
      success: true,
      message: "Purchase successful",
      correlationId: "corr-4",
      timestamp: new Date().toISOString(),
      data: { purchaseId: "p1", userId: "buyer@example.com", itemId: "1" },
    });
    const onClose = vi.fn();
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");

    render(<Wrapper onClose={onClose} />);

    await user.type(screen.getByLabelText(/email address/i), "buyer@example.com");
    await user.click(screen.getByRole("button", { name: /confirm purchase/i }));
    await screen.findByText("Purchase successful!");

    expect(onClose).not.toHaveBeenCalled();

    // Fire the auto-close timer directly instead of waiting 10 real seconds.
    const autoCloseCall = setTimeoutSpy.mock.calls.find(([, delay]) => delay === 10_000);
    expect(autoCloseCall).toBeTruthy();
    (autoCloseCall as unknown as [() => void, number])[0]();

    expect(onClose).toHaveBeenCalled();
    setTimeoutSpy.mockRestore();
  });

  it("surfaces a rate-limit message and keeps the form open", async () => {
    const user = userEvent.setup();
    vi.mocked(flashSaleRequests.fetchCsrfToken).mockResolvedValue({
      token: "a".repeat(32),
      expiresAt: new Date().toISOString(),
    });
    vi.mocked(flashSaleRequests.submitPurchase).mockRejectedValue({
      response: {
        data: {
          errorCode: "RATE_LIMITED",
          message: "Too many requests",
          correlationId: "corr-3",
          timestamp: new Date().toISOString(),
          statusCode: 429,
        },
      },
    });

    render(<Wrapper />);

    await user.type(screen.getByLabelText(/email address/i), "buyer@example.com");
    await user.click(screen.getByRole("button", { name: /confirm purchase/i }));

    expect(await screen.findByText(/going a bit fast/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /confirm purchase/i })).not.toBeDisabled(),
    );
  });
});
