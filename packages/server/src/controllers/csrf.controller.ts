import { FastifyRequest } from "fastify";
import { csrfService } from "../services";

export async function csrfTokenHandler(
  _request: FastifyRequest
) {
  return await csrfService.generateToken();
}