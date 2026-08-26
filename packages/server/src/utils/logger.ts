import pino from "pino";
import { FLASH_SALE_CONFIG } from "../config";

// ============= Main Logger =============

export const logger = pino({
    level: FLASH_SALE_CONFIG.logLevel,
    transport:
        FLASH_SALE_CONFIG.nodeEnv === "production"
            ? undefined
            : {
                target: "pino-pretty",
                options: {
                    colorize: true,
                    translateTime: "SYS:standard",
                    ignore: "pid,hostname",
                },
            },
    timestamp: pino.stdTimeFunctions.isoTime,
});

// ============= Request Logging Helpers =============

export function logRequestStart(
    correlationId: string,
    method: string,
    url: string
): void {
    logger.debug(
        { correlationId, method, url },
        `[REQUEST] ${method} ${url}`
    );
}

export function logRequestEnd(
    correlationId: string,
    method: string,
    url: string,
    statusCode: number,
    durationMs: number
): void {
    logger.info(
        { correlationId, method, url, statusCode, durationMs },
        `[RESPONSE] ${method} ${url} → ${statusCode} (${durationMs}ms)`
    );
}

/**
 * Expected business rejections (out of stock, already purchased, bad
 * input, etc.) are logged at `warn` without a stack trace - they're
 * routine and would otherwise drown out real faults for anyone on-call.
 * Only truly unexpected errors (5xx) are logged at `error` with the stack.
 */
export function logError(
    correlationId: string,
    error: Error,
    context: string,
    severity: "warn" | "error" = "error"
): void {
    logger[severity](
        {
            correlationId,
            error: error.message,
            ...(severity === "error" ? { stack: error.stack } : {}),
            context,
        },
        `[${severity.toUpperCase()}] ${context}`
    );
}