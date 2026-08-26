import { FastifyInstance, FastifyRequest } from "fastify";
import { purchaseHandler } from "../controllers";
import { postgresRepository } from "../repositories";
import { FLASH_SALE_CONFIG } from "../config";
import { getSaleWindow } from "../utils/sale-window";

export async function registerPurchaseRoutes(app: FastifyInstance) {
    app.post(
        "/api/v1/purchase",
        {
            schema: {
                tags: ["Purchase"],
                description: "Submit a purchase with optimistic locking",
                body: {
                    type: "object",
                    required: ["userId", "csrfToken"],
                    properties: {
                        userId: { type: "string" },
                        csrfToken: { type: "string" },
                    },
                },
            },
        },
        purchaseHandler
    );

    app.get(
        "/api/v1/status",
        {
            schema: {
                tags: ["Sale"],
                description: "Get current flash sale status",
            },
        },
        async (_request: FastifyRequest) => {
            const item = await postgresRepository.getItem();
            const { status, timeRemaining } = getSaleWindow(
                new Date(),
                FLASH_SALE_CONFIG.saleStartTime,
                FLASH_SALE_CONFIG.saleEndTime
            );

            return {
                item,
                status,
                saleActive: status === "active",
                stockRemaining: item.stock,
                timeRemaining,
            };
        }
    );

    app.get(
        "/api/v1/purchase-status",
        {
            schema: {
                tags: ["Purchase"],
                description: "Check whether this user has secured an item",
                querystring: {
                    type: "object",
                    required: ["userId"],
                    properties: {
                        userId: { type: "string" },
                    },
                },
            },
        },
        async (request: FastifyRequest) => {
            const { userId } = request.query as { userId: string };
            const purchase = await postgresRepository.getPurchaseByUser(userId);

            return {
                userId,
                hasPurchased: !!purchase,
                purchaseId: purchase?.id,
                timestamp: new Date().toISOString(),
            };
        }
    );
}