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
