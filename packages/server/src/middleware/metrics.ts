import { MetricsResponse } from "../models";

// ============= Metrics Collector =============

export class MetricsCollector {
  private requestCount = 0;
  private errorCount = 0;
  private latencies: number[] = [];
  private statusCodes: Map<number, number> = new Map();
  private maxLatencies = 10000;

  /**
   * Record request latency (in milliseconds)
   */
  recordLatency(durationMs: number): void {
    this.requestCount++;
    this.latencies.push(durationMs);

    if (this.latencies.length > this.maxLatencies) {
      this.latencies.shift();
    }
  }

  /**
   * Record error
   */
  recordError(): void {
    this.errorCount++;
  }

  /**
   * Record status code
   */
  recordStatusCode(code: number): void {
    this.statusCodes.set(code, (this.statusCodes.get(code) || 0) + 1);
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(percentile: number): number {
    if (this.latencies.length === 0) return 0;

    const sorted = [...this.latencies].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get metrics snapshot
   */
  getMetrics(): MetricsResponse {
    return {
      timestamp: new Date().toISOString(),
      requests: {
        total: this.requestCount,
        successful: this.requestCount - this.errorCount,
        failed: this.errorCount,
      },
      latency: {
        p50: this.calculatePercentile(50),
        p95: this.calculatePercentile(95),
        p99: this.calculatePercentile(99),
      },
      errorRate:
        this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0,
      statusCodes: Object.fromEntries(this.statusCodes),
    };
  }

  /**
   * Reset metrics (for testing)
   */
  reset(): void {
    this.requestCount = 0;
    this.errorCount = 0;
    this.latencies = [];
    this.statusCodes.clear();
  }
}

export const metrics = new MetricsCollector();