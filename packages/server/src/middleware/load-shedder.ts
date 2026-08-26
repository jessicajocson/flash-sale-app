import { logger } from "../utils/logger";

// ============= Load Shedder =============

export class LoadShedder {
  private currentConcurrency = 0;
  private peakConcurrency = 0;
  private maxConcurrentRequests: number;

  constructor(maxConcurrentRequests: number = 1000) {
    this.maxConcurrentRequests = maxConcurrentRequests;
  }

  /**
   * Try to acquire a request slot
   */
  tryAcquire(): boolean {
    if (this.currentConcurrency >= this.maxConcurrentRequests) {
      logger.warn(
        {
          current: this.currentConcurrency,
          max: this.maxConcurrentRequests,
        },
        "Load shedder: rejecting request (max concurrency exceeded)"
      );
      return false;
    }

    this.currentConcurrency++;
    this.peakConcurrency = Math.max(
      this.peakConcurrency,
      this.currentConcurrency
    );
    return true;
  }

  /**
   * Release a request slot
   */
  release(): void {
    this.currentConcurrency = Math.max(0, this.currentConcurrency - 1);
  }

  /**
   * Get current concurrency
   */
  getCurrentConcurrency(): number {
    return this.currentConcurrency;
  }

  /**
   * Get peak concurrency
   */
  getPeakConcurrency(): number {
    return this.peakConcurrency;
  }

  /**
   * Reset (for testing)
   */
  reset(): void {
    this.currentConcurrency = 0;
    this.peakConcurrency = 0;
  }
}

// Default 1000 concurrent requests
export const loadShedder = new LoadShedder(1000);