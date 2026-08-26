import { FastifyInstance } from "fastify";
import { adminMetricsHandler, adminPurchaseLogHandler } from "../controllers";

// Just for Swagger UI docs - no `required`, since the handlers already
// check the key and return our own 401/403 instead of Fastify's generic 500.
const adminKeyHeaderSchema = {
  type: "object",
  properties: {
    "x-admin-key": {
      type: "string",
      description: "Admin key (matches the server's ADMIN_KEY env var)",
    },
  },
} as const;

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get(
    "/admin/metrics",
    {
      schema: {
        tags: ["Admin"],
        description: "Admin metrics (requires X-Admin-Key header)",
        headers: adminKeyHeaderSchema,
      },
    },
    adminMetricsHandler
  );

  app.get(
    "/admin/purchase-log",
    {
      schema: {
        tags: ["Admin"],
        description: "Admin purchase log (requires X-Admin-Key header)",
        headers: adminKeyHeaderSchema,
      },
    },
    adminPurchaseLogHandler
  );
}