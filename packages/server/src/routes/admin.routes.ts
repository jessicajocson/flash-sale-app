import { FastifyInstance } from "fastify";
import { adminMetricsHandler, adminPurchaseLogHandler } from "../controllers";

// Documents the header for Swagger UI's "Try it out" (adds an input field
// for it) without an accompanying `required` list - actual presence/value
// checking stays in the handlers (AdminKeySchema + timingSafeEqual), which
// return the app's own 401 INVALID_ADMIN_KEY/403 shape. Marking it required
// here instead would make Fastify's schema validation reject a missing
// header before the handler ever runs, falling through to the generic
// unhandled-error path (500) instead of that intentional response.
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