export interface AppErrorResponse {
    errorCode: string;
    message: string;
    correlationId: string;
    timestamp: string;
    statusCode: number;
}

export enum ErrorCode {
    VALIDATION_ERROR = "VALIDATION_ERROR",
    RATE_LIMITED = "RATE_LIMITED",
    INVALID_CSRF = "INVALID_CSRF",
    SALE_NOT_ACTIVE = "SALE_NOT_ACTIVE",
    PURCHASE_FAILED = "PURCHASE_FAILED",
    OUT_OF_STOCK = "OUT_OF_STOCK",
    CIRCUIT_OPEN = "CIRCUIT_OPEN",
    LOAD_SHED = "LOAD_SHED",
    UNAUTHORIZED = "UNAUTHORIZED",
    INVALID_ADMIN_KEY = "INVALID_ADMIN_KEY",
    INTERNAL_ERROR = "INTERNAL_ERROR",
}