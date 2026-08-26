import { FastifyInstance } from "fastify";
import { csrfTokenHandler } from "../controllers";

export async function registerCsrfRoutes(app: FastifyInstance) {
  app.get(
    "/api/v1/csrf-token",
    {
      schema: {
        tags: ["Security"],
        description: "Generate one-time CSRF token",
      },
    },
    csrfTokenHandler
  );
}