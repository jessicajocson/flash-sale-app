import Fastify, { FastifyInstance } from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import { FLASH_SALE_CONFIG } from "./config";
import { logger, logRequestEnd, logError } from "./utils/logger";
import {
  correlationIdMiddleware,
  loadShedder,
  metrics,
} from "./middleware";
import { registerAllRoutes } from "./routes";
import { AppError, ErrorFactory } from "./utils/errors";
import { database } from "./utils/database";
import { redis_service } from "./utils/redis";
import { initializeDatabase } from "./db/database-utils";
import { circuitBreaker } from "./middleware";

async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
  });

  await app.register(fastifyHelmet);
  await app.register(fastifyCors, {
    origin: FLASH_SALE_CONFIG.corsOrigin,
  });

  // Swagger Documentation
  await app.register(fastifySwagger, {
    swagger: {
      info: {
        title: "Flash Sale API",
        description:
          "Production-grade flash sale backend with optimistic locking",
        version: "1.0.0",
      },
      host: `localhost:${FLASH_SALE_CONFIG.port}`,
      schemes: ["http"],
      consumes: ["application/json"],
      produces: ["application/json"],
      tags: [
        { name: "Health", description: "Health check endpoints" },
        { name: "Sale", description: "Flash sale status" },
        { name: "Security", description: "CSRF token generation" },
        { name: "Purchase", description: "Purchase operations" },
        { name: "Admin", description: "Admin-only endpoints" },
      ],
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
    },
  });

  // Correlation ID + Request Logging
  app.addHook("preHandler", correlationIdMiddleware);

  // Load Shedding
  app.addHook("preHandler", async (request, _reply) => {
    if (!loadShedder.tryAcquire()) {
      throw ErrorFactory.loadShed((request as any).correlationId);
    }
  });

  // Release concurrency slot
  app.addHook("onResponse", async (_request) => {
    loadShedder.release();
  });

  // Metrics & Logging
  app.addHook("onResponse", async (request, reply) => {
    const startTime = (request as any).startTime || Date.now();
    const durationMs = Date.now() - startTime;

    metrics.recordLatency(durationMs);
    metrics.recordStatusCode(reply.statusCode);

    if (reply.statusCode >= 400) {
      metrics.recordError();
    }

    logRequestEnd(
      (request as any).correlationId,
      request.method,
      request.url,
      reply.statusCode,
      durationMs
    );
  });

  // Error Handler
  app.setErrorHandler(
    async (error: Error, request, reply) => {
      const correlationId = (request as any).correlationId;

      if (error instanceof AppError) {
        const isServerFault = error.statusCode >= 500;
        logError(correlationId, error, "Request rejected", isServerFault ? "error" : "warn");
        if (isServerFault) {
          circuitBreaker.recordFailure();
        }
        return reply.status(error.statusCode).send(error.toJSON());
      }

      logError(correlationId, error, "Unhandled error");
      circuitBreaker.recordFailure();
      const appError = ErrorFactory.internal(correlationId);
      return reply.status(500).send(appError.toJSON());
    }
  );

  await registerAllRoutes(app);

  return app;
}

async function start() {
  try {
    logger.info("Connecting to PostgreSQL...");
    await database.connect();

    logger.info("Connecting to Redis...");
    await redis_service.connect();

    logger.info("Initializing database schema...");
    await initializeDatabase();

    const app = await buildServer();

    await app.listen({
      port: FLASH_SALE_CONFIG.port,
      host: FLASH_SALE_CONFIG.host,
    });

    logger.info(
      {
        port: FLASH_SALE_CONFIG.port,
        host: FLASH_SALE_CONFIG.host,
        env: FLASH_SALE_CONFIG.nodeEnv,
        database: FLASH_SALE_CONFIG.databaseUrl.split("@")[1] || "localhost",
        redis: FLASH_SALE_CONFIG.redisUrl,
      },
      "⚡ Flash Sale Server Ready - Production Grade"
    );

    logger.info(
      `📚 Swagger Docs: http://localhost:${FLASH_SALE_CONFIG.port}/docs`
    );

    // Shutdown handler
    const shutdown = async () => {
      logger.info("Shutting down gracefully...");

      try {
        await app.close();
        await database.disconnect();
        await redis_service.disconnect();

        logger.info("Shutdown complete");
        process.exit(0);
      } catch (error) {
        logger.error(error, "Error during shutdown");
        process.exit(1);
      }
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    logger.error(error, "Server startup failed");
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

export { buildServer };