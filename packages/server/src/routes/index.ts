import { FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./health.routes";
import { registerPurchaseRoutes } from "./purchase.routes";
import { registerCsrfRoutes } from "./csrf.routes";
import { registerAdminRoutes } from "./admin.routes";

export async function registerAllRoutes(app: FastifyInstance) {
  await registerHealthRoutes(app);
  await registerPurchaseRoutes(app);
  await registerCsrfRoutes(app);
  await registerAdminRoutes(app);
}