import { describe, it, expect } from "vitest";
import { formatCountdown, formatPrice } from "./format";

describe("formatCountdown", () => {
  it("formats minutes and seconds under an hour", () => {
    expect(formatCountdown(65_000)).toBe("01:05");
  });

  it("includes hours once an hour or more remains", () => {
    expect(formatCountdown(3_661_000)).toBe("1:01:01");
  });

  it("floors zero/negative remaining time to 00:00", () => {
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-500)).toBe("00:00");
  });
});

describe("formatPrice", () => {
  it("formats a numeric price as USD", () => {
    expect(formatPrice(99.99)).toBe("$99.99");
  });

  it("formats a string price the same way (Postgres DECIMAL comes back as a string)", () => {
    expect(formatPrice("99.99")).toBe("$99.99");
  });
});
