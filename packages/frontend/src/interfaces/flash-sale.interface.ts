export interface FlashSaleItem {
  id: string;
  name: string;
  price: number | string;
  stock: number;
  version: number;
}

export type SaleStatus = "upcoming" | "active" | "ended";

export interface SaleStatusResponse {
  item: FlashSaleItem;
  status: SaleStatus;
  saleActive: boolean;
  stockRemaining: number;
  timeRemaining: number;
}

export interface CsrfTokenResponse {
  token: string;
  expiresAt: string;
}

/**
 * Guards against trusting a malformed/unexpected body as a real status
 * response - e.g. if a request ever lands on a route that falls back to
 * serving the SPA's index.html (200 OK, wrong content) instead of the API.
 */
export function isSaleStatusResponse(value: unknown): value is SaleStatusResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as SaleStatusResponse).item === "object" &&
    (value as SaleStatusResponse).item !== null
  );
}
