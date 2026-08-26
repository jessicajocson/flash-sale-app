// Mirrors packages/server/src/models/purchase.model.ts
// (only the response shapes the frontend actually consumes - admin/health
// response types live server-side only, since no UI screen calls those endpoints)

export interface PurchaseResponse {
  success: true;
  message: string;
  correlationId: string;
  timestamp: string;
  data: {
    purchaseId: string;
    userId: string;
    itemId: string;
  };
}

export interface PurchaseStatusResponse {
  userId: string;
  hasPurchased: boolean;
  purchaseId?: string;
  timestamp: string;
}
