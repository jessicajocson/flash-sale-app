import { httpClient } from "../fetch";
import type {
  CsrfTokenResponse,
  PurchaseResponse,
  PurchaseStatusResponse,
  SaleStatusResponse,
} from "../../interfaces";

export async function getSaleStatus(): Promise<SaleStatusResponse> {
  const { data } = await httpClient.get<SaleStatusResponse>("/status");
  return data;
}

export async function getPurchaseStatus(userId: string): Promise<PurchaseStatusResponse> {
  const { data } = await httpClient.get<PurchaseStatusResponse>("/purchase-status", {
    params: { userId },
  });
  return data;
}

export async function fetchCsrfToken(): Promise<CsrfTokenResponse> {
  const { data } = await httpClient.get<CsrfTokenResponse>("/csrf-token");
  return data;
}

export async function submitPurchase(
  userId: string,
  csrfToken: string
): Promise<PurchaseResponse> {
  const { data } = await httpClient.post<PurchaseResponse>("/purchase", { userId, csrfToken });
  return data;
}
