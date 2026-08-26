import axios, { AxiosError } from "axios";
import type { ApiErrorResponse } from "../interfaces";

/** Shared HTTP client - relative baseURL so requests stay same-origin (see vite.config.ts proxy). */
export const httpClient = axios.create({ baseURL: "/api/v1" });

/** Every API failure we handle is either our typed error shape or a network/unknown fault. */
export interface ApiFailure {
  errorCode: string;
  message: string;
}

export function toApiFailure(error: unknown): ApiFailure {
  const axiosError = error as AxiosError<ApiErrorResponse>;
  if (axiosError.response?.data?.errorCode) {
    return {
      errorCode: axiosError.response.data.errorCode,
      message: axiosError.response.data.message,
    };
  }
  return {
    errorCode: "NETWORK_ERROR",
    message: "Couldn't reach the server. Check your connection and try again.",
  };
}
