/**
 * Stress test for the flash sale purchase endpoint.
 *
 * This drives real HTTP traffic (Node's built-in fetch) at an already
 * running server instance - it does NOT spin the server up itself, so it
 * exercises the exact same network/DB path a real user would.
 *
 * It resets state by connecting to Postgres/Redis directly (same as the
 * server does), independent of the HTTP layer, so the run is reproducible.
 *
 * Usage (with the dev server already running on :3001):
 *   npm run test:stress
 *   npm run test:stress -- --stock=500 --concurrency=250
 *
 * Flags:
 *   --url          Base URL of the running server (default http://localhost:3001)
 *   --stock        Units available for the oversell phase (default 200)
 *   --users        Distinct users competing for that stock (default 5x stock)
 *   --concurrency  Max in-flight purchase requests per batch (default 200)
 *   --raceAttempts Concurrent same-user attempts for the one-per-user phase (default 25)
 */
import { database } from "../utils/database";
import { redis_service } from "../utils/redis";
import { postgresRepository } from "../repositories";

interface Args {
  url: string;
  stock: number;
  users: number;
  concurrency: number;
  raceAttempts: number;
}

function parseArgs(): Args {
  const flags = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) flags.set(match[1], match[2]);
  }

  const stock = parseInt(flags.get("stock") || "200", 10);
  return {
    url: flags.get("url") || "http://localhost:3001",
    stock,
    users: parseInt(flags.get("users") || String(stock * 5), 10),
    concurrency: parseInt(flags.get("concurrency") || "200", 10),
    raceAttempts: parseInt(flags.get("raceAttempts") || "25", 10),
  };
}

interface RequestResult {
  status: number;
  reason: string;
  latencyMs: number;
}

async function timedFetch(
  url: string,
  init?: RequestInit
): Promise<{ status: number; body: any; latencyMs: number }> {
  const start = Date.now();
  const res = await fetch(url, init);
  const latencyMs = Date.now() - start;
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, latencyMs };
}

/** Run `items` through `worker` in batches of at most `concurrency` at a time. */
async function runInBatches<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(worker));
    results.push(...batchResults);
  }
  return results;
}

async function fetchCsrfToken(baseUrl: string): Promise<string> {
  const { body } = await timedFetch(`${baseUrl}/api/v1/csrf-token`);
  return body.token;
}

async function attemptPurchase(
  baseUrl: string,
  userId: string,
  csrfToken: string
): Promise<RequestResult> {
  const { status, body, latencyMs } = await timedFetch(
    `${baseUrl}/api/v1/purchase`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, csrfToken }),
    }
  );
  return { status, reason: body.message || body.data?.purchaseId || "?", latencyMs };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function report(label: string, results: RequestResult[], wallMs: number) {
  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const byStatus = new Map<string, number>();
  for (const r of results) {
    const key = `${r.status} (${r.reason})`;
    byStatus.set(key, (byStatus.get(key) || 0) + 1);
  }

  console.log(`\n--- ${label} ---`);
  console.log(`requests: ${results.length}, wall time: ${wallMs}ms, throughput: ${(
    (results.length / wallMs) *
    1000
  ).toFixed(1)} req/s`);
  console.log(
    `latency ms - p50: ${percentile(latencies, 50)}, p95: ${percentile(
      latencies,
      95
    )}, p99: ${percentile(latencies, 99)}, max: ${latencies[latencies.length - 1] ?? 0}`
  );
  console.log("outcomes:");
  for (const [key, count] of [...byStatus.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(6)}  ${key}`);
  }
}

async function main() {
  const args = parseArgs();
  let failed = false;

  console.log(`Connecting to Postgres/Redis to reset state (server should already be running at ${args.url})...`);
  await database.connect();
  await redis_service.connect();

  // ============= Phase A: no-oversell under high concurrency =============
  console.log(
    `\nPhase A: ${args.users} distinct users competing for ${args.stock} units (concurrency ${args.concurrency})`
  );
  await postgresRepository.reset(args.stock);

  const userIds = Array.from({ length: args.users }, (_, i) => `stress-user-${i}`);

  const tokenStart = Date.now();
  const tokens = await runInBatches(userIds, args.concurrency, () =>
    fetchCsrfToken(args.url)
  );
  console.log(`Fetched ${tokens.length} CSRF tokens in ${Date.now() - tokenStart}ms`);

  const purchaseStart = Date.now();
  const results = await runInBatches(
    userIds.map((userId, i) => ({ userId, token: tokens[i] })),
    args.concurrency,
    ({ userId, token }) => attemptPurchase(args.url, userId, token)
  );
  const purchaseWallMs = Date.now() - purchaseStart;

  report("Phase A: distinct users vs. limited stock", results, purchaseWallMs);

  const successCount = results.filter((r) => r.status === 201).length;
  const finalItem = await postgresRepository.getItem();
  const finalPurchaseCount = await postgresRepository.getPurchaseCount();
  const expectedSuccesses = Math.min(args.stock, args.users);

  console.log(
    `\nExpected successes: ${expectedSuccesses}, actual: ${successCount}, final stock: ${finalItem.stock}, purchases recorded: ${finalPurchaseCount}`
  );

  if (
    successCount !== expectedSuccesses ||
    finalPurchaseCount !== expectedSuccesses ||
    finalItem.stock !== args.stock - expectedSuccesses
  ) {
    console.error("FAIL: oversold or undersold - stock accounting does not match!");
    failed = true;
  } else {
    console.log("PASS: no overselling - successes exactly match available stock.");
  }

  // ============= Phase B: one purchase per user under a race =============
  console.log(
    `\nPhase B: ${args.raceAttempts} concurrent purchase attempts from the SAME user`
  );
  await postgresRepository.reset(Math.max(10, args.raceAttempts));

  const raceUserId = "stress-race-user";
  const raceTokens = await runInBatches(
    Array.from({ length: args.raceAttempts }),
    args.concurrency,
    () => fetchCsrfToken(args.url)
  );

  const raceStart = Date.now();
  const raceResults = await runInBatches(raceTokens, args.concurrency, (token) =>
    attemptPurchase(args.url, raceUserId, token)
  );
  const raceWallMs = Date.now() - raceStart;

  report("Phase B: same user, concurrent attempts", raceResults, raceWallMs);

  const raceSuccessCount = raceResults.filter((r) => r.status === 201).length;
  console.log(`\nExpected exactly 1 success, actual: ${raceSuccessCount}`);

  if (raceSuccessCount !== 1) {
    console.error("FAIL: one-purchase-per-user was violated under a race!");
    failed = true;
  } else {
    console.log("PASS: exactly one purchase succeeded for the racing user.");
  }

  await database.disconnect();
  await redis_service.disconnect();

  if (failed) {
    console.error("\nSTRESS TEST FAILED");
    process.exit(1);
  }

  console.log("\nSTRESS TEST PASSED");
}

main().catch((error) => {
  console.error("Stress test crashed:", error);
  process.exit(1);
});
