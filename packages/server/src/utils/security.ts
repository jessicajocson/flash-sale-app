import { z } from "zod";
import crypto from "crypto";

// ============= Admin Key Validation =============

export const AdminKeySchema = z
    .string()
    .min(1, "Admin key required")
    .max(256, "Admin key too long");

// ============= Timing-safe comparison =============

/**
 * Constant-time string comparison to prevent timing attacks on secrets
 * like the admin key. A plain `===` leaks how many leading characters
 * matched via response-time differences.
 */
export function timingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);

    if (bufA.length !== bufB.length) {
        // Still run a comparison of equal length to avoid a short-circuit
        // timing signal on length alone.
        crypto.timingSafeEqual(bufA, bufA);
        return false;
    }

    return crypto.timingSafeEqual(bufA, bufB);
}
