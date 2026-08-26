import { FastifyRequest, FastifyReply } from "fastify";
import { PurchaseRequestSchema } from "../models";
import { purchaseService } from "../services";
import { ErrorFactory } from "../utils/errors";
import { circuitBreaker } from "../middleware";
import { z } from "zod";

export async function purchaseHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const correlationId = (request as any).correlationId;

  // Check circuit breaker
  if (!circuitBreaker.canProceed()) {
    throw ErrorFactory.circuitOpen(correlationId);
  }

  // Validate input
  let body;
  try {
    body = PurchaseRequestSchema.parse(request.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw ErrorFactory.validation(error.errors[0].message, correlationId);
    }
    throw error;
  }

  // Process purchase
  const result = await purchaseService.processPurchase(body, correlationId);

  circuitBreaker.recordSuccess();

  return reply.status(201).send(result);
}