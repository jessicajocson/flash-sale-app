import postgres from "postgres";
import { FLASH_SALE_CONFIG } from "../config";
import { logger } from "../utils/logger";

export type PostgresDatabase = ReturnType<typeof postgres>;
class DatabaseManager {
  private connection: PostgresDatabase | null = null;

  async connect(): Promise<PostgresDatabase> {
    try {
      this.connection = postgres(FLASH_SALE_CONFIG.databaseUrl, {
        max: FLASH_SALE_CONFIG.databasePoolSize,
        idle_timeout: FLASH_SALE_CONFIG.databaseIdleTimeout,
        connect_timeout: 10,
      });

      // Test connection
      await this.connection`SELECT 1`;

      logger.info(
        { poolSize: FLASH_SALE_CONFIG.databasePoolSize },
        "Database connected"
      );

      return this.connection;
    } catch (error) {
      logger.error(error, "Failed to connect to database");
      throw error;
    }
  }

  get(): PostgresDatabase {
    if (!this.connection) {
      throw new Error("Database not connected. Call connect() first.");
    }
    return this.connection;
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
      logger.info("Database disconnected");
    }
  }

  isConnected(): boolean {
    return this.connection !== null;
  }
}

// Singleton Instance
const db = new DatabaseManager();

// Exports
export { db as database };

// Backward compatibility exports
export const connectDatabase = () => db.connect();
export const getDatabase = () => db.get();
export const disconnectDatabase = () => db.disconnect();