import { createClient, RedisClientType } from "redis";
import { FLASH_SALE_CONFIG } from "../config";
import { logger } from "../utils/logger";

// ============= Type Exports =============
export type RedisClient = RedisClientType;

// ============= Redis Manager Class =============
class RedisManager {
  private connection: RedisClientType | null = null;

  async connect(): Promise<RedisClientType> {
    try {
      const client = createClient({
        url: FLASH_SALE_CONFIG.redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error("Redis reconnection failed after 10 attempts");
              return new Error("Redis max retries reached");
            }
            return retries * 100;
          },
        },
      });

      client.on("error", (err) => logger.error(err, "Redis error"));
      client.on("connect", () => logger.info("✅ Redis connected"));
      client.on("disconnect", () => logger.info("Redis disconnected"));

      await client.connect();
      this.connection = client;

      return client;
    } catch (error) {
      logger.error(error, "❌ Failed to connect to Redis");
      throw error;
    }
  }

  get(): RedisClientType {
    if (!this.connection) {
      throw new Error("Redis not connected. Call connect() first.");
    }
    return this.connection;
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.quit();
      this.connection = null;
      logger.info("Redis disconnected");
    }
  }

  isConnected(): boolean {
    return this.connection !== null;
  }
}

// ============= Singleton Instance =============
const redis = new RedisManager();

// ============= Exports =============
export { redis as redis_service };

// Backward compatibility exports
export const connectRedis = () => redis.connect();
export const getRedis = () => redis.get();
export const disconnectRedis = () => redis.disconnect();