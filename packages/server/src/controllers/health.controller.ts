import { FastifyRequest } from "fastify";
import { circuitBreaker } from "../middleware";
import { ErrorFactory } from "../utils/errors";
import { HealthResponse } from "../models";

export async function healthCheckHandler(
  request: FastifyRequest
): Promise<HealthResponse> {
  if (!circuitBreaker.canProceed()) {
    throw ErrorFactory.circuitOpen((request as any).correlationId);
  }

  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
}