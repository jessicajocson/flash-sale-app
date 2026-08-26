// Runs before any test file's own imports (vitest `setupFiles`), so this is
// the one place we can set env vars that `config/flash-sale.config.ts`
// reads at module-load time. A wide, currently-active sale window keeps
// most tests from having to think about the upcoming/ended edges - those
// are covered separately via the pure `getSaleWindow` unit tests instead
// of fighting the config singleton.
//
// Everything below is a dynamic `import()` rather than a static `import`
// on purpose: static imports are hoisted and evaluate before any of this
// file's own top-level code runs, which would load `config` (via the
// database/redis utils) *before* these env vars are set.
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.SALE_START =
  process.env.SALE_START || new Date(Date.now() - 5 * 60_000).toISOString();
process.env.SALE_END =
  process.env.SALE_END || new Date(Date.now() + 2 * 60 * 60_000).toISOString();

const { beforeAll, afterAll } = await import("vitest");
const { database } = await import("../utils/database");
const { redis_service } = await import("../utils/redis");
const { initializeDatabase } = await import("../db/database-utils");

beforeAll(async () => {
  await database.connect();
  await redis_service.connect();
  await initializeDatabase();
}, 30000);

afterAll(async () => {
  await database.disconnect();
  await redis_service.disconnect();
});
