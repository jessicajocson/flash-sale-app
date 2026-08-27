import { readFileSync } from "fs";
import { join } from "path";
import { getDatabase } from "../utils/database";
import { logger } from "../utils/logger";
import { FLASH_SALE_CONFIG } from "../config";

/**
 * Initialize database: Create tables and seed data
 * This runs on startup if needed
 */
export async function initializeDatabase(): Promise<void> {
  const db = getDatabase();

  try {
    logger.info("Initializing database schema...");

    // Read init.sql - the seed INSERT's stock/original_stock values are a
    // placeholder token, not a literal, so this stays configurable via the
    // STOCK env var instead of being hardcoded in the SQL file.
    const initSqlPath = join(__dirname, "./init.sql");
    const initSql = readFileSync(initSqlPath, "utf-8").replace(
      /__STOCK__/g,
      String(FLASH_SALE_CONFIG.stock)
    );

    // Run the whole file in one call so postgres.js can parse dollar-quoted
    // blocks (DO $$ ... $$, CREATE FUNCTION ... $$) correctly - naive
    // splitting on ";" breaks those, since their bodies contain semicolons.
    try {
      await db.unsafe(initSql);
    } catch (error: any) {
      // Ignore "already exists" errors
      if (!error.message?.includes("already exists")) {
        throw error;
      }
    }

    logger.info("✅ Database initialization completed");
  } catch (error) {
    logger.error(error, "❌ Database initialization failed");
    throw error;
  }
}

/**
 * Reset database: Drop all tables and recreate
 * DANGEROUS - only for testing!
 */
export async function resetDatabase(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Cannot reset database in production!");
  }

  const db = getDatabase();

  try {
    logger.warn("⚠️ RESETTING DATABASE - ALL DATA WILL BE LOST");

    // Drop tables (in reverse order of dependencies)
    await db.unsafe(`DROP TABLE IF EXISTS rate_limit_requests CASCADE`);
    await db.unsafe(`DROP TABLE IF EXISTS audit_logs CASCADE`);
    await db.unsafe(`DROP TABLE IF EXISTS csrf_tokens CASCADE`);
    await db.unsafe(`DROP TABLE IF EXISTS purchases CASCADE`);
    await db.unsafe(`DROP TABLE IF EXISTS flash_sale_items CASCADE`);

    // Drop views
    await db.unsafe(`DROP VIEW IF EXISTS v_recent_audit_activity CASCADE`);
    await db.unsafe(`DROP VIEW IF EXISTS v_purchases_by_user CASCADE`);

    // Drop functions
    await db.unsafe(`DROP FUNCTION IF EXISTS cleanup_expired_csrf_tokens CASCADE`);
    await db.unsafe(`DROP FUNCTION IF EXISTS cleanup_old_audit_logs CASCADE`);
    await db.unsafe(`DROP FUNCTION IF EXISTS get_system_stats CASCADE`);

    logger.warn("✅ Database reset completed");

    // Reinitialize
    await initializeDatabase();
  } catch (error) {
    logger.error(error, "❌ Database reset failed");
    throw error;
  }
}

/**
 * Get database statistics
 */
export async function getSystemStats(): Promise<{
  totalPurchases: number;
  uniqueUsers: number;
  currentStock: number;
  currentVersion: number;
  totalAuditLogs: number;
  auditLogs24h: number;
}> {
  const db = getDatabase();

  const result = await db`
    SELECT * FROM get_system_stats()
  `;

  if (result.length === 0) {
    throw new Error("Failed to get system stats");
  }

  const stats = result[0];
  return {
    totalPurchases: stats.total_purchases || 0,
    uniqueUsers: stats.unique_users || 0,
    currentStock: stats.current_stock || 0,
    currentVersion: stats.current_version || 0,
    totalAuditLogs: stats.total_audit_logs || 0,
    auditLogs24h: stats.audit_logs_24h || 0,
  };
}

/**
 * Check database health
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  message: string;
  response_time_ms: number;
}> {
  const db = getDatabase();
  const start = Date.now();

  try {
    await db`SELECT 1`;
    const responseTime = Date.now() - start;

    return {
      healthy: true,
      message: "Database connection OK",
      response_time_ms: responseTime,
    };
  } catch (error) {
    return {
      healthy: false,
      message: `Database connection failed: ${(error as Error).message}`,
      response_time_ms: Date.now() - start,
    };
  }
}

/**
 * Cleanup tasks (run periodically)
 */
export async function runCleanupTasks(): Promise<void> {
  const db = getDatabase();

  try {
    logger.info("Running database cleanup tasks...");

    // Clean expired CSRF tokens
    await db.unsafe(`SELECT cleanup_expired_csrf_tokens()`);
    logger.debug("✅ Expired CSRF tokens cleaned");

    // Clean old audit logs (keep 90 days)
    if (process.env.NODE_ENV === "production") {
      await db.unsafe(`SELECT cleanup_old_audit_logs()`);
      logger.debug("✅ Old audit logs cleaned");
    }

    logger.info("✅ Cleanup tasks completed");
  } catch (error) {
    logger.error(error, "❌ Cleanup tasks failed");
    // Don't throw - cleanup failures shouldn't crash the app
  }
}

/**
 * Export database statistics (for monitoring)
 */
export async function exportDatabaseMetrics(): Promise<string> {
  try {
    const stats = await getSystemStats();
    const health = await checkDatabaseHealth();

    return `
# HELP flash_sale_total_purchases Total purchases processed
# TYPE flash_sale_total_purchases counter
flash_sale_total_purchases ${stats.totalPurchases}

# HELP flash_sale_unique_users Unique users who made purchases
# TYPE flash_sale_unique_users gauge
flash_sale_unique_users ${stats.uniqueUsers}

# HELP flash_sale_current_stock Current inventory stock
# TYPE flash_sale_current_stock gauge
flash_sale_current_stock ${stats.currentStock}

# HELP flash_sale_current_version Current version number (optimistic locking)
# TYPE flash_sale_current_version gauge
flash_sale_current_version ${stats.currentVersion}

# HELP flash_sale_audit_logs_total Total audit log entries
# TYPE flash_sale_audit_logs_total counter
flash_sale_audit_logs_total ${stats.totalAuditLogs}

# HELP flash_sale_audit_logs_24h Audit logs in last 24 hours
# TYPE flash_sale_audit_logs_24h gauge
flash_sale_audit_logs_24h ${stats.auditLogs24h}

# HELP flash_sale_database_health Database health status (1=healthy, 0=unhealthy)
# TYPE flash_sale_database_health gauge
flash_sale_database_health ${health.healthy ? 1 : 0}

# HELP flash_sale_database_response_time_ms Database response time in milliseconds
# TYPE flash_sale_database_response_time_ms gauge
flash_sale_database_response_time_ms ${health.response_time_ms}
    `.trim();
  } catch (error) {
    logger.error(error, "Failed to export database metrics");
    return "# Error exporting metrics";
  }
}