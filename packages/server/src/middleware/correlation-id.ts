import { randomUUID } from "crypto";
import { FastifyRequest, FastifyReply } from "fastify";
import { logRequestStart } from "../utils/logger";

/**
 * Generate or extract correlation ID from request
 * Used to trace requests through entire system
 */
export function generateCorrelationId(): string {
    return randomUUID();
}

/**
 * Middleware: Add correlation ID to every request
 */
export async function correlationIdMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
) {
    const correlationId =
        (request.headers["x-correlation-id"] as string) || generateCorrelationId();

    // Store on request for access in handlers
    (request as any).correlationId = correlationId;

    // Add to response headers
    reply.header("X-Correlation-ID", correlationId);

    // Log request start
    logRequestStart(correlationId, request.method, request.url);
}