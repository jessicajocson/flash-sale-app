import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { buildServer } from "../index";
import { postgresRepository, redisRepository } from "../repositories";
import { csrfService } from "../services";

let app: FastifyInstance;

async function getApp(): Promise<FastifyInstance> {
  if (!app) {
    app = await buildServer();
    await app.ready();
  }
  return app;
}

async function resetState(stock: number) {
  await postgresRepository.reset(stock);
  await redisRepository.reset();
}

async function purchase(userId: string, csrfToken?: string) {
  const server = await getApp();
  const token = csrfToken ?? (await csrfService.generateToken()).token;
  return server.inject({
    method: "POST",
    url: "/api/v1/purchase",
    payload: { userId, csrfToken: token },
  });
}

afterAll(async () => {
  if (app) {
    await app.close();
  }
});

describe("GET /api/v1/status", () => {
  it("reports the active sale with correct stock", async () => {
    await resetState(42);
    const server = await getApp();

    const res = await server.inject({ method: "GET", url: "/api/v1/status" });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.status).toBe("active");
    expect(body.saleActive).toBe(true);
    expect(body.stockRemaining).toBe(42);
  });
});

describe("CSRF protection", () => {
  beforeEach(() => resetState(10));

  it("rejects a purchase with a well-formed but unissued csrf token", async () => {
    const server = await getApp();
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/purchase",
      // 32 chars, so it passes shape validation but was never issued
      payload: { userId: "csrf-user-1", csrfToken: "0".repeat(32) },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().errorCode).toBe("INVALID_CSRF");
  });

  it("a token can only be used once", async () => {
    const { token } = await csrfService.generateToken();

    const first = await purchase("csrf-user-2", token);
    expect(first.statusCode).toBe(201);

    const second = await purchase("csrf-user-3", token);
    expect(second.statusCode).toBe(400);
    expect(second.json().errorCode).toBe("INVALID_CSRF");
  });
});

describe("Input validation", () => {
  it("rejects userIds with disallowed characters", async () => {
    const res = await purchase("not valid!");
    expect(res.statusCode).toBe(400);
    expect(res.json().errorCode).toBe("VALIDATION_ERROR");
  });

  it("accepts an email-shaped userId", async () => {
    await resetState(5);
    const res = await purchase("jane.doe@example.com");
    expect(res.statusCode).toBe(201);
  });
});

describe("One purchase per user", () => {
  beforeEach(() => resetState(10));

  it("a second purchase attempt by the same user is rejected", async () => {
    const first = await purchase("repeat-user");
    expect(first.statusCode).toBe(201);
    expect(first.json().data.purchaseId).toBeTruthy();

    const second = await purchase("repeat-user");
    expect(second.statusCode).toBe(400);
    expect(second.json().message).toMatch(/already purchased/i);

    // Stock only decremented once
    const item = await postgresRepository.getItem();
    expect(item.stock).toBe(9);
  });

  it("purchase-status reflects hasPurchased and the purchaseId", async () => {
    const server = await getApp();

    const before = await server.inject({
      method: "GET",
      url: "/api/v1/purchase-status?userId=status-user",
    });
    expect(before.json().hasPurchased).toBe(false);

    const result = await purchase("status-user");
    const purchaseId = result.json().data.purchaseId;

    const after = await server.inject({
      method: "GET",
      url: "/api/v1/purchase-status?userId=status-user",
    });
    expect(after.json().hasPurchased).toBe(true);
    expect(after.json().purchaseId).toBe(purchaseId);
  });

  it("holds under a same-user race: exactly one of many concurrent attempts succeeds", async () => {
    const userId = "race-user";
    const attempts = 5;
    const tokens = await Promise.all(
      Array.from({ length: attempts }, () => csrfService.generateToken())
    );

    const results = await Promise.all(
      tokens.map((t) => purchase(userId, t.token))
    );

    const successes = results.filter((r) => r.statusCode === 201);
    const alreadyPurchased = results.filter(
      (r) => r.statusCode === 400 && /already purchased/i.test(r.json().message)
    );

    expect(successes).toHaveLength(1);
    expect(alreadyPurchased).toHaveLength(attempts - 1);

    const item = await postgresRepository.getItem();
    expect(item.stock).toBe(9);
  });
});

describe("Stock exhaustion under concurrency (no oversell)", () => {
  it("exactly `stock` distinct users succeed when demand exceeds supply", async () => {
    const stock = 20;
    const demand = stock + 50;
    await resetState(stock);

    const tokens = await Promise.all(
      Array.from({ length: demand }, () => csrfService.generateToken())
    );

    const results = await Promise.all(
      tokens.map((t, i) => purchase(`bulk-user-${i}`, t.token))
    );

    const successes = results.filter((r) => r.statusCode === 201);
    const outOfStock = results.filter(
      (r) => r.statusCode === 400 && /out of stock/i.test(r.json().message)
    );

    expect(successes).toHaveLength(stock);
    expect(outOfStock).toHaveLength(demand - stock);

    const item = await postgresRepository.getItem();
    expect(item.stock).toBe(0);

    const purchaseCount = await postgresRepository.getPurchaseCount();
    expect(purchaseCount).toBe(stock);
  }, 30000);
});

describe("Rate limiting", () => {
  it("blocks a user's 11th request within the rate limit window", async () => {
    await resetState(1);
    const userId = "rate-limit-user";

    const responses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await purchase(userId);
      responses.push(res.statusCode);
    }

    // First succeeds, the next several fail as "already purchased" but
    // still count against the rate limit, and the 11th is rejected outright.
    expect(responses[0]).toBe(201);
    expect(responses[10]).toBe(429);
  }, 20000);
});

describe("Admin endpoints", () => {
  it("rejects a missing X-Admin-Key as malformed (401)", async () => {
    const server = await getApp();
    const missing = await server.inject({ method: "GET", url: "/admin/metrics" });
    expect(missing.statusCode).toBe(401);
  });

  it("rejects a well-formed but wrong X-Admin-Key as unauthorized (403)", async () => {
    const server = await getApp();
    const wrong = await server.inject({
      method: "GET",
      url: "/admin/metrics",
      headers: { "x-admin-key": "definitely-wrong" },
    });
    expect(wrong.statusCode).toBe(403);
  });
});
