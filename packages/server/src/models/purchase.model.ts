import { z } from "zod";

// ============= Request Models =============

export const PurchaseRequestSchema = z.object({
  userId: z
    .string()
    .min(1, "userId required")
    .max(256, "userId too long")
    .regex(
      /^[a-zA-Z0-9_.@-]+$/,
      "userId must be a username or email (letters, numbers, . _ - @)"
    ),
  csrfToken: z.string().min(1, "csrfToken required").length(32, "Invalid token"),
});

export type PurchaseRequest = z.infer<typeof PurchaseRequestSchema>;

// ============= Response Models =============

export interface PurchaseResponse {
  success: boolean;
  message: string;
  correlationId: string;
  timestamp: string;
  data?: {
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

// ============= Admin Response =============

export interface AdminMetricsResponse {
  timestamp: string;
  metrics: {
    requests: {
      total: number;
      successful: number;
      failed: number;
    };
    latency: {
      p50: number;
      p95: number;
      p99: number;
    };
    errorRate: number;
    statusCodes: Record<number, number>;
  };
  circuitBreakerState: "CLOSED" | "OPEN" | "HALF_OPEN";
  currentConcurrency: number;
  peakConcurrency: number;
}

export interface AdminPurchaseLogResponse {
  purchases: Array<{
    userId: string;
    itemId: string;
    timestamp: Date;
    correlationId: string;
  }>;
  total: number;
  auditLog: Array<{
    timestamp: string;
    correlationId: string;
    action: string;
    userId?: string;
    details: Record<string, any>;
    success: boolean;
  }>;
  timestamp: string;
}