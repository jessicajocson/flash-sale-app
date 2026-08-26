import { describe, it, expect, beforeEach } from "vitest";
import { CircuitBreaker } from "../middleware/circuit-breaker";
import { LoadShedder } from "../middleware/load-shedder";
import { MetricsCollector } from "../middleware/metrics";
import { getSaleWindow } from "../utils/sale-window";

describe("getSaleWindow (pure tri-state sale logic)", () => {
  const start = new Date("2026-01-01T00:00:00Z");
  const end = new Date("2026-01-01T01:00:00Z");

  it("is upcoming before the start time", () => {
    const now = new Date("2025-12-31T23:00:00Z");
    const result = getSaleWindow(now, start, end);
    expect(result.status).toBe("upcoming");
    expect(result.timeRemaining).toBe(start.getTime() - now.getTime());
  });

  it("is active between start (inclusive) and end", () => {
    expect(getSaleWindow(start, start, end).status).toBe("active");
    const now = new Date("2026-01-01T00:30:00Z");
    const result = getSaleWindow(now, start, end);
    expect(result.status).toBe("active");
    expect(result.timeRemaining).toBe(end.getTime() - now.getTime());
  });

  it("is ended at and after the end time", () => {
    expect(getSaleWindow(end, start, end).status).toBe("ended");
    const result = getSaleWindow(new Date("2026-01-02T00:00:00Z"), start, end);
    expect(result.status).toBe("ended");
    expect(result.timeRemaining).toBe(0);
  });
});

describe("CircuitBreaker", () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker(3, 1000);
  });

  it("starts CLOSED and allows requests", () => {
    expect(breaker.getState()).toBe("CLOSED");
    expect(breaker.canProceed()).toBe(true);
  });

  it("opens after the failure threshold is reached", () => {
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getState()).toBe("CLOSED");
    breaker.recordFailure();
    expect(breaker.getState()).toBe("OPEN");
    expect(breaker.canProceed()).toBe(false);
  });

  it("a success resets the failure count", () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordSuccess();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getState()).toBe("CLOSED");
  });

  it("moves OPEN -> HALF_OPEN after the reset timeout, then CLOSED on success", async () => {
    const fastBreaker = new CircuitBreaker(1, 10);
    fastBreaker.recordFailure();
    expect(fastBreaker.getState()).toBe("OPEN");
    expect(fastBreaker.canProceed()).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(fastBreaker.canProceed()).toBe(true);
    expect(fastBreaker.getState()).toBe("HALF_OPEN");
    fastBreaker.recordSuccess();
    expect(fastBreaker.getState()).toBe("CLOSED");
  });
});

describe("LoadShedder", () => {
  it("rejects once max concurrency is reached, and tracks the peak", () => {
    const shedder = new LoadShedder(2);
    expect(shedder.tryAcquire()).toBe(true);
    expect(shedder.tryAcquire()).toBe(true);
    expect(shedder.tryAcquire()).toBe(false);
    expect(shedder.getCurrentConcurrency()).toBe(2);
    expect(shedder.getPeakConcurrency()).toBe(2);

    shedder.release();
    expect(shedder.getCurrentConcurrency()).toBe(1);
    expect(shedder.tryAcquire()).toBe(true);
  });

  it("never releases below zero", () => {
    const shedder = new LoadShedder(5);
    shedder.release();
    expect(shedder.getCurrentConcurrency()).toBe(0);
  });
});

describe("MetricsCollector", () => {
  it("computes p50/p95/p99 from recorded latencies", () => {
    const collector = new MetricsCollector();
    for (let i = 1; i <= 100; i++) {
      collector.recordLatency(i);
    }

    const metrics = collector.getMetrics();
    expect(metrics.requests.total).toBe(100);
    expect(metrics.latency.p50).toBe(50);
    expect(metrics.latency.p95).toBe(95);
    expect(metrics.latency.p99).toBe(99);
  });

  it("computes error rate from recorded errors vs. total requests", () => {
    const collector = new MetricsCollector();
    collector.recordLatency(1);
    collector.recordLatency(2);
    collector.recordLatency(3);
    collector.recordLatency(4);
    collector.recordError();

    const metrics = collector.getMetrics();
    expect(metrics.requests.total).toBe(4);
    expect(metrics.requests.failed).toBe(1);
    expect(metrics.errorRate).toBe(25);
  });
});
