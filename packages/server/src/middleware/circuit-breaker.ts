import { logger } from "../utils/logger";

// ============= Circuit Breaker =============

export class CircuitBreaker {
    private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
    private failureCount = 0;
    private failureThreshold: number;
    private resetTimeout: number;
    private lastFailureTime = 0;

    constructor(failureThreshold: number = 50, resetTimeout: number = 60000) {
        this.failureThreshold = failureThreshold;
        this.resetTimeout = resetTimeout;
    }

    /**
     * Record a successful operation
     */
    recordSuccess(): void {
        this.failureCount = 0;
        if (this.state === "HALF_OPEN") {
            this.state = "CLOSED";
            logger.info("Circuit breaker: HALF_OPEN → CLOSED");
        }
    }

    /**
     * Record a failed operation
     */
    recordFailure(): void {
        this.lastFailureTime = Date.now();
        this.failureCount++;

        const errorRate = this.failureCount;

        if (errorRate >= this.failureThreshold && this.state === "CLOSED") {
            this.state = "OPEN";
            logger.warn(
                "Circuit breaker: CLOSED → OPEN (error threshold exceeded)"
            );
        }
    }

    /**
     * Check if circuit breaker allows requests
     */
    canProceed(): boolean {
        if (this.state === "CLOSED") {
            return true;
        }

        if (this.state === "OPEN") {
            if (Date.now() - this.lastFailureTime > this.resetTimeout) {
                this.state = "HALF_OPEN";
                this.failureCount = 0;
                logger.info(
                    "Circuit breaker: OPEN → HALF_OPEN (retry after timeout)"
                );
                return true;
            }
            return false;
        }

        if (this.state === "HALF_OPEN") {
            return true;
        }

        return true;
    }

    /**
     * Get state
     */
    getState(): "CLOSED" | "OPEN" | "HALF_OPEN" {
        return this.state;
    }

    /**
     * Reset (for testing)
     */
    reset(): void {
        this.state = "CLOSED";
        this.failureCount = 0;
        this.lastFailureTime = 0;
    }
}

export const circuitBreaker = new CircuitBreaker(50, 60000);