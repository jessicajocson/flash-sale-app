import { AppErrorResponse, ErrorCode } from "../models";

export class AppError extends Error {
    constructor(
        public errorCode: ErrorCode | string,
        public message: string,
        public statusCode: number,
        public correlationId: string
    ) {
        super(message);
        this.name = "AppError";
    }

    toJSON(): AppErrorResponse {
        return {
            errorCode: this.errorCode,
            message: this.message,
            correlationId: this.correlationId,
            timestamp: new Date().toISOString(),
            statusCode: this.statusCode,
        };
    }
}

export class ErrorFactory {
    static validation(message: string, correlationId: string): AppError {
        return new AppError(
            ErrorCode.VALIDATION_ERROR,
            message,
            400,
            correlationId
        );
    }

    static rateLimited(correlationId: string): AppError {
        return new AppError(ErrorCode.RATE_LIMITED, "Too many requests", 429, correlationId);
    }

    static invalidCsrf(correlationId: string): AppError {
        return new AppError(
            ErrorCode.INVALID_CSRF,
            "CSRF token invalid or expired",
            400,
            correlationId
        );
    }

    static saleNotActive(correlationId: string): AppError {
        return new AppError(
            ErrorCode.SALE_NOT_ACTIVE,
            "Sale is not active",
            400,
            correlationId
        );
    }

    static purchaseFailed(reason: string, correlationId: string): AppError {
        return new AppError(
            ErrorCode.PURCHASE_FAILED,
            reason || "Purchase failed",
            400,
            correlationId
        );
    }

    static circuitOpen(correlationId: string): AppError {
        return new AppError(
            ErrorCode.CIRCUIT_OPEN,
            "Circuit breaker is open",
            503,
            correlationId
        );
    }

    static loadShed(correlationId: string): AppError {
        return new AppError(
            ErrorCode.LOAD_SHED,
            "Server at capacity",
            503,
            correlationId
        );
    }

    static unauthorized(correlationId: string): AppError {
        return new AppError(ErrorCode.UNAUTHORIZED, "Unauthorized", 403, correlationId);
    }

    static invalidAdminKey(correlationId: string): AppError {
        return new AppError(
            ErrorCode.INVALID_ADMIN_KEY,
            "Invalid admin key",
            401,
            correlationId
        );
    }

    static internal(correlationId: string): AppError {
        return new AppError(
            ErrorCode.INTERNAL_ERROR,
            "Internal server error",
            500,
            correlationId
        );
    }
}