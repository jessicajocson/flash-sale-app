import { metrics } from "../middleware/metrics";
import { MetricsResponse } from "../models";

export class MetricsService {
  getMetrics(): MetricsResponse {
    return metrics.getMetrics();
  }

  reset(): void {
    metrics.reset();
  }
}

export const metricsService = new MetricsService();