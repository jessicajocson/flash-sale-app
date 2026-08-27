import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProductCard from "./ProductCard";
import type { SaleStatusResponse } from "../interfaces";

function buildStatus(overrides: Partial<SaleStatusResponse> = {}): SaleStatusResponse {
  return {
    item: { id: "1", name: "Limited Edition Item", price: "99.99", stock: 10, originalStock: 10, version: 0 },
    status: "active",
    saleActive: true,
    stockRemaining: 10,
    timeRemaining: 60_000,
    ...overrides,
  };
}

const noop = () => {};

const baseProps = {
  timeRemainingMs: 65_000,
  loading: false,
  error: false,
  hasPurchased: false,
  securedEmail: "",
  onResetIdentity: noop,
  onBuyClick: noop,
};

describe("ProductCard", () => {
  it("shows the product image and a loading message before the first status arrives", () => {
    render(<ProductCard {...baseProps} status={null} loading timeRemainingMs={0} />);
    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.getByText(/checking sale status/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /loading/i })).toBeDisabled();
  });

  it("keeps showing the product image and shows an error message if status stays null and isn't loading", () => {
    render(<ProductCard {...baseProps} status={null} timeRemainingMs={0} />);
    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.getByText(/could not connect to the server/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /unavailable/i })).toBeDisabled();
  });

  it("shows a stale-data warning if a later poll fails while status data is already loaded", () => {
    render(<ProductCard {...baseProps} status={buildStatus()} error />);
    expect(screen.getByText(/showing last known status/i)).toBeInTheDocument();
    expect(screen.queryByText(/could not connect to the server/i)).not.toBeInTheDocument();
  });

  it("renders the upcoming state with a disabled button and countdown to start", () => {
    render(
      <ProductCard
        {...baseProps}
        status={buildStatus({ status: "upcoming", saleActive: false })}
      />,
    );
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
    expect(screen.getByText("00")).toBeInTheDocument();
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("05")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /not open yet/i })).toBeDisabled();
  });

  it("renders the active state with a stock meter and an enabled buy button", () => {
    render(<ProductCard {...baseProps} status={buildStatus({ stockRemaining: 7 })} />);
    expect(screen.getByText("On sale")).toBeInTheDocument();
    expect(screen.getByText("7 / 10 left")).toBeInTheDocument();
    expect(screen.getByText("00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /buy now/i })).not.toBeDisabled();
  });

  it("renders sold out when active but no stock remains", () => {
    render(<ProductCard {...baseProps} status={buildStatus({ stockRemaining: 0 })} />);
    expect(screen.getAllByText("Sold out").length).toBeGreaterThan(0);
    expect(screen.getByText(/every unit has been claimed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sold out/i })).toBeDisabled();
  });

  it("renders the ended state", () => {
    render(
      <ProductCard {...baseProps} status={buildStatus({ status: "ended", saleActive: false })} />,
    );
    expect(screen.getByText("Ended")).toBeInTheDocument();
    expect(screen.getByText(/this sale has ended/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sale ended/i })).toBeDisabled();
  });

  it("shows 'Already secured' and disables the button when the user already purchased", () => {
    render(<ProductCard {...baseProps} status={buildStatus()} hasPurchased />);
    expect(screen.getByRole("button", { name: /already secured/i })).toBeDisabled();
  });

  it("explains which identity is secured and lets the viewer reset it", async () => {
    const user = userEvent.setup();
    const onResetIdentity = vi.fn();
    render(
      <ProductCard
        {...baseProps}
        status={buildStatus()}
        hasPurchased
        securedEmail="buyer@example.com"
        onResetIdentity={onResetIdentity}
      />,
    );

    expect(screen.getByText(/secured as buyer@example\.com/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /reset/i }));
    expect(onResetIdentity).toHaveBeenCalled();
  });

  it("doesn't show the identity hint when nobody has purchased yet", () => {
    render(<ProductCard {...baseProps} status={buildStatus()} />);
    expect(screen.queryByText(/secured as/i)).not.toBeInTheDocument();
  });
});
