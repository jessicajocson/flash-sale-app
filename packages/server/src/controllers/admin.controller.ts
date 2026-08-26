import { FastifyRequest } from "fastify";
import { FLASH_SALE_CONFIG } from "../config";
import { postgresRepository, redisRepository } from "../repositories";
import { metricsService } from "../services";
import { circuitBreaker, loadShedder } from "../middleware";
import { ErrorFactory } from "../utils/errors";
import { AdminKeySchema, timingSafeEqual } from "../utils/security";
import { getDatabase } from "../utils/database";

export async function adminMetricsHandler(
  request: FastifyRequest
) {
  const correlationId = (request as any).correlationId;
  const adminKey = request.headers["x-admin-key"] as string;

  try {
    AdminKeySchema.parse(adminKey);
  } catch {
    throw ErrorFactory.invalidAdminKey(correlationId);
  }

  if (!timingSafeEqual(adminKey, FLASH_SALE_CONFIG.adminKey)) {
    throw ErrorFactory.unauthorized(correlationId);
  }

  return {
    ...metricsService.getMetrics(),
    circuitBreakerState: circuitBreaker.getState(),
    currentConcurrency: loadShedder.getCurrentConcurrency(),
    peakConcurrency: loadShedder.getPeakConcurrency(),
  };
}

export async function adminPurchaseLogHandler(
  request: FastifyRequest
) {
  const correlationId = (request as any).correlationId;
  const adminKey = request.headers["x-admin-key"] as string;

  try {
    AdminKeySchema.parse(adminKey);
  } catch {
    throw ErrorFactory.invalidAdminKey(correlationId);
  }

  if (!timingSafeEqual(adminKey, FLASH_SALE_CONFIG.adminKey)) {
    throw ErrorFactory.unauthorized(correlationId);
  }

  const db = getDatabase();

  // Get purchases from PostgreSQL
  const purchases = await postgresRepository.getAllPurchases();
  const totalPurchases = await postgresRepository.getPurchaseCount();

  // Get audit logs from database
  const auditLogs = await db`
    SELECT 
      timestamp,
      correlation_id as "correlationId",
      action,
      user_id as "userId",
      details,
      success
    FROM audit_logs
    ORDER BY timestamp DESC
    LIMIT 1000
  `;

  // Also include Redis audit logs (in-flight)
  const redisAuditLogs = await redisRepository.getAuditLogs(100);

  return {
    purchases,
    total: totalPurchases,
    auditLog: [...redisAuditLogs, ...auditLogs],
    timestamp: new Date().toISOString(),
  };
}