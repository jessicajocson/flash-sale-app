import { FLASH_SALE_CONFIG } from "../config";
import { postgresRepository, redisRepository } from "../repositories";
import { PurchaseRequest, PurchaseResponse } from "../models";
import { ErrorFactory } from "../utils/errors";
import { getDatabase } from "../utils/database";
import { getSaleWindow } from "../utils/sale-window";

export class PurchaseService {
  async processPurchase(
    request: PurchaseRequest,
    correlationId: string
  ): Promise<PurchaseResponse> {
    // Rate limiting via Redis
    const isRateLimited = await redisRepository.isRateLimited(request.userId);
    if (isRateLimited) {
      await redisRepository.logAudit(
        "RATE_LIMIT_EXCEEDED",
        { userId: request.userId },
        correlationId,
        request.userId,
        false
      );

      throw ErrorFactory.rateLimited(correlationId);
    }

    // Check sale time
    const { status } = getSaleWindow(
      new Date(),
      FLASH_SALE_CONFIG.saleStartTime,
      FLASH_SALE_CONFIG.saleEndTime
    );
    if (status !== "active") {
      throw ErrorFactory.saleNotActive(correlationId);
    }

    // Verify CSRF token via Redis
    const csrfValid = await redisRepository.verifyCsrfToken(request.csrfToken);
    if (!csrfValid) {
      await redisRepository.logAudit(
        "INVALID_CSRF_TOKEN",
        { userId: request.userId },
        correlationId,
        request.userId,
        false
      );

      throw ErrorFactory.invalidCsrf(correlationId);
    }

    // Attempt purchase - serialized via PostgreSQL row lock (FOR UPDATE)
    const result = await postgresRepository.attemptPurchase(
      request.userId,
      correlationId
    );

    if (!result.success) {
      await redisRepository.logAudit(
        "PURCHASE_FAILED",
        { userId: request.userId, reason: result.reason },
        correlationId,
        request.userId,
        false
      );

      throw ErrorFactory.purchaseFailed(
        result.reason || "Purchase failed",
        correlationId
      );
    }

    // Log to database (audit trail)
    const db = getDatabase();
    await db`
      INSERT INTO audit_logs (correlation_id, action, user_id, details, success)
      VALUES (${correlationId}, 'PURCHASE_SUCCESS', ${request.userId}, ${JSON.stringify({
      purchaseId: result.purchaseId,
    })}, true)
    `;

    // Success
    await redisRepository.logAudit(
      "PURCHASE_SUCCESS",
      { userId: request.userId, purchaseId: result.purchaseId },
      correlationId,
      request.userId,
      true
    );

    return {
      success: true,
      message: "Purchase successful",
      correlationId,
      timestamp: new Date().toISOString(),
      data: {
        purchaseId: result.purchaseId!,
        userId: request.userId,
        itemId: result.itemId!,
      },
    };
  }
}

export const purchaseService = new PurchaseService();