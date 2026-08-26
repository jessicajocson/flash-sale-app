import { FLASH_SALE_CONFIG } from "../config";
import { redisRepository } from "../repositories";
import { CsrfTokenResponse } from "../models";

export class CsrfService {
  async generateToken(): Promise<CsrfTokenResponse> {
    const token = await redisRepository.generateCsrfToken();

    return {
      token,
      expiresAt: new Date(
        Date.now() + FLASH_SALE_CONFIG.csrfTokenExpiry * 1000
      ).toISOString(),
    };
  }
}

export const csrfService = new CsrfService();