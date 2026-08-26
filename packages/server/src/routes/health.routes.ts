import { FastifyInstance } from "fastify";
import { healthCheckHandler } from "../controllers";
import { metricsService } from "../services";

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get(
    "/health",
    {
      schema: {
        tags: ["Health"],
        description: "Server health check",
      },
    },
    healthCheckHandler
  );

  app.get(
    "/metrics",
    {
      schema: {
        tags: ["Health"],
        description: "Prometheus-style metrics (P50/P95/P99 latency)",
      },
    },
    async () => metricsService.getMetrics()
  );
}