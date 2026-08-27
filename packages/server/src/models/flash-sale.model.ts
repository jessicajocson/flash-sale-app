export interface FlashSaleItem {
    id: string;
    name: string;
    price: number;
    stock: number;
    originalStock: number;
    version: number;
  }
  
  export interface Purchase {
    id: string;
    userId: string;
    itemId: string;
    timestamp: Date;
    correlationId: string;
  }

  export interface SaleStatusResponse {
    item: FlashSaleItem;
    status: "upcoming" | "active" | "ended";
    saleActive: boolean;
    stockRemaining: number;
    timeRemaining: number;
  }
  
  export interface CsrfTokenResponse {
    token: string;
    expiresAt: string;
  }
  
  export interface HealthResponse {
    status: "healthy" | "degraded" | "unhealthy";
    timestamp: string;
    uptime: number;
  }
  
  export interface MetricsResponse {
    timestamp: string;
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
  }