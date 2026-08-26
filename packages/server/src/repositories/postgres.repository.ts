import { FlashSaleItem, Purchase } from "../models";
import { database } from "../utils/database";
import { logger } from "../utils/logger";

// ============= PostgreSQL Flash Sale Repository =============

export class PostgresFlashSaleRepository {
  /**
   * Get current sale item
   */
  async getItem(): Promise<FlashSaleItem> {
    const db = database.get();

    const result = await db<FlashSaleItem[]>`
      SELECT id, name, price, stock, version
      FROM flash_sale_items
      ORDER BY created_at ASC
      LIMIT 1
    `;

    if (result.length === 0) {
      throw new Error("Flash sale item not found");
    }

    return result[0];
  }

  /**
   * Get total purchase count
   */
  async getPurchaseCount(): Promise<number> {
    const db = database.get();

    // COUNT(*) is bigint in Postgres, which the driver returns as a string
    // to avoid silent precision loss - cast to int32 here since purchase
    // counts for a single flash sale item will never approach that range.
    const result = await db<{ count: number }[]>`
      SELECT COUNT(*)::int as count FROM purchases
    `;

    return result[0]?.count || 0;
  }

  /**
   * Get purchase by ID
   */
  async getPurchase(purchaseId: string): Promise<Purchase | undefined> {
    const db = database.get();

    const result = await db<Purchase[]>`
      SELECT id, user_id as "userId", item_id as "itemId", created_at as timestamp, correlation_id as "correlationId"
      FROM purchases
      WHERE id = ${purchaseId}
    `;

    return result[0];
  }

  /**
   * Get a user's purchase for the current item, if any
   */
  async getPurchaseByUser(userId: string): Promise<Purchase | undefined> {
    const db = database.get();

    const result = await db<Purchase[]>`
      SELECT id, user_id as "userId", item_id as "itemId", created_at as timestamp, correlation_id as "correlationId"
      FROM purchases
      WHERE user_id = ${userId}
      LIMIT 1
    `;

    return result[0];
  }

  /**
   * Get all purchases (for admin)
   */
  async getAllPurchases(): Promise<Purchase[]> {
    const db = database.get();

    return await db<Purchase[]>`
      SELECT
        id,
        user_id as "userId",
        item_id as "itemId",
        created_at as timestamp,
        correlation_id as "correlationId"
      FROM purchases
      ORDER BY created_at DESC
    `;
  }

  /**
   * Attempt purchase inside a single database transaction.
   *
   * There is only one item row for this flash sale, so `SELECT ... FOR
   * UPDATE` on that row already serializes every purchase attempt
   * system-wide - no two transactions can be inside this block at the same
   * time. That makes it safe to do the "already purchased?" check and the
   * stock check as plain reads right here, instead of layering a separate
   * optimistic-version compare on top (a version captured before the lock
   * queue is stale by the time a transaction reaches the front of the
   * queue under load, which would reject purchases even while stock
   * remains - see README for the full write-up).
   *
   * Steps, all atomic:
   * 1. Lock the single item row (FOR UPDATE)
   * 2. Reject if this user already has a purchase for it
   * 3. Reject if stock is exhausted
   * 4. Decrement stock, insert the purchase record
   */
  async attemptPurchase(
    userId: string,
    correlationId: string
  ): Promise<{
    success: boolean;
    purchaseId?: string;
    itemId?: string;
    reason?: string;
    alreadyPurchased?: boolean;
  }> {
    const db = database.get();

    try {
      const result = await db.begin(async (tx) => {
        // 1. Get current item with lock (FOR UPDATE) - serializes all purchases
        const items = await tx<
          Array<{ id: string; stock: number; version: number }>
        >`
          SELECT id, stock, version
          FROM flash_sale_items
          ORDER BY created_at ASC
          LIMIT 1
          FOR UPDATE
        `;

        if (items.length === 0) {
          throw new Error("Item not found");
        }

        const item = items[0];

        // 2. One purchase per user
        const existing = await tx<Array<{ id: string }>>`
          SELECT id FROM purchases
          WHERE user_id = ${userId} AND item_id = ${item.id}
          LIMIT 1
        `;

        if (existing.length > 0) {
          return {
            success: false,
            itemId: item.id,
            reason: "You have already purchased this item",
            alreadyPurchased: true,
          };
        }

        // 3. Check stock
        if (item.stock <= 0) {
          return {
            success: false,
            itemId: item.id,
            reason: "Out of stock",
          };
        }

        // 4. Update item: decrement stock, bump version (audit trail)
        await tx`
          UPDATE flash_sale_items
          SET
            stock = stock - 1,
            version = version + 1,
            updated_at = NOW()
          WHERE id = ${item.id}
        `;

        // 5. Create purchase record
        const purchases = await tx<Array<{ id: string }>>`
          INSERT INTO purchases (user_id, item_id, correlation_id)
          VALUES (${userId}, ${item.id}, ${correlationId})
          RETURNING id
        `;

        const purchaseId = purchases[0]?.id;

        return {
          success: true,
          purchaseId,
          itemId: item.id,
        };
      });

      return result;
    } catch (error: any) {
      // Defense-in-depth: a unique-violation on (user_id, item_id) means
      // another code path raced past the in-transaction check above.
      if (error?.code === "23505") {
        return {
          success: false,
          reason: "You have already purchased this item",
          alreadyPurchased: true,
        };
      }

      logger.error(error, "Purchase attempt failed");
      return {
        success: false,
        reason: "Database error",
      };
    }
  }

  /**
   * Reset for testing (DO NOT USE IN PRODUCTION)
   */
  async reset(initialStock: number): Promise<void> {
    const db = database.get();

    await db`
      UPDATE flash_sale_items
      SET stock = ${initialStock}, version = 0, updated_at = NOW()
      WHERE name = 'Nova Runner — Sunset Edition'
    `;

    await db`DELETE FROM purchases`;
  }
}

export const postgresRepository = new PostgresFlashSaleRepository();