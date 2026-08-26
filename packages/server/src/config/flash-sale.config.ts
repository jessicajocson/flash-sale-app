// ============= Flash Sale Configuration =============

import { z } from "zod";

export interface FlashSaleConfig {
  // Server
  port: number;
  host: string;
  nodeEnv: "development" | "staging" | "production";
  logLevel: "debug" | "info" | "warn" | "error";

  // Database
  databaseUrl: string;
  databasePoolSize: number;
  databaseIdleTimeout: number;

  // Redis
  redisUrl: string;

  // Flash Sale
  stock: number;
  saleStartTime: Date;
  saleEndTime: Date;

  // CORS
  corsOrigin: string;

  // Security
  adminKey: string;
  csrfTokenExpiry: number;
  rateLimitMaxRequests: number;
  rateLimitWindow: number;

  // Metrics
  maxConcurrentRequests: number;
  circuitBreakerThreshold: number;
}

function parseEnvDate(dateStr: string | undefined, fallback: Date): Date {
  if (!dateStr) return fallback;
  try {
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

const DEV_ADMIN_KEY = "dev-admin-secret-key";

// In production, refuse to boot with a missing/weak/default admin key -
// that key gates admin-only endpoints, so a silent fallback there is a
// live credential leak rather than a convenience default.
const ProductionAdminKeySchema = z
  .string()
  .min(16, "ADMIN_KEY must be at least 16 characters in production")
  .refine(
    (val) => val !== DEV_ADMIN_KEY,
    "ADMIN_KEY must not use the default development value in production"
  );

function resolveAdminKey(nodeEnv: string): string {
  const raw = process.env.ADMIN_KEY;
  if (nodeEnv === "production") {
    const result = ProductionAdminKeySchema.safeParse(raw);
    if (!result.success) {
      throw new Error(
        `Invalid ADMIN_KEY: ${result.error.issues.map((i) => i.message).join(", ")}`
      );
    }
    return result.data;
  }
  return raw || DEV_ADMIN_KEY;
}

export function loadFlashSaleConfig(): FlashSaleConfig {
  const now = new Date();
  const saleStart = new Date(now.getTime() + 60000);
  const saleEnd = new Date(now.getTime() + 5 * 60000);
  const nodeEnv = (process.env.NODE_ENV as FlashSaleConfig["nodeEnv"]) || "development";

  return {
    port: parseInt(process.env.PORT || "3001", 10),
    host: process.env.HOST || "0.0.0.0",
    nodeEnv,
    logLevel: (process.env.LOG_LEVEL as any) || "info",
    databaseUrl:
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5433/flash_sale_db",
    databasePoolSize: parseInt(process.env.DATABASE_POOL_SIZE || "10", 10),
    databaseIdleTimeout: parseInt(process.env.DATABASE_IDLE_TIMEOUT || "30000", 10),
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
    stock: parseInt(process.env.STOCK || "100", 10),
    saleStartTime: parseEnvDate(process.env.SALE_START, saleStart),
    saleEndTime: parseEnvDate(process.env.SALE_END, saleEnd),
    corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
    adminKey: resolveAdminKey(nodeEnv),
    csrfTokenExpiry: 3600,
    rateLimitMaxRequests: 10,
    rateLimitWindow: 60,
    maxConcurrentRequests: 1000,
    circuitBreakerThreshold: 50,
  };
}

export const FLASH_SALE_CONFIG = loadFlashSaleConfig();