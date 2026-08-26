-- ============================================================================
-- Flash Sale System - Database Initialization Script
-- ============================================================================
-- This script creates all tables, indexes, and initial data
-- Run this on fresh PostgreSQL database
-- ============================================================================

-- ============================================================================
-- 1. CREATE EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 2. CREATE TABLES
-- ============================================================================

-- ============================================================================
-- 2.1 FLASH SALE ITEMS TABLE
-- ============================================================================
-- Stores the flash sale item and inventory
-- Uses version column for optimistic locking (prevent race conditions)

-- `name` is UNIQUE so the seed insert below has a stable conflict target -
-- this app is single-product by design, and there must only ever be one row.
CREATE TABLE IF NOT EXISTS flash_sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  price DECIMAL(10, 2) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 100,
  original_stock INTEGER NOT NULL DEFAULT 100,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT stock_non_negative CHECK (stock >= 0),
  CONSTRAINT original_stock_positive CHECK (original_stock > 0),
  CONSTRAINT price_positive CHECK (price > 0)
);

-- Migration for databases created before `original_stock` existed - a
-- no-op on a fresh table, since CREATE TABLE above already has the column.
ALTER TABLE flash_sale_items ADD COLUMN IF NOT EXISTS original_stock INTEGER NOT NULL DEFAULT 100;

-- Index for frequent lookups
CREATE INDEX IF NOT EXISTS idx_flash_sale_items_created_at
ON flash_sale_items(created_at DESC);

-- ============================================================================
-- 2.2 PURCHASES TABLE
-- ============================================================================
-- Immutable transaction history
-- Every purchase is recorded for audit trail

CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(256) NOT NULL,
  item_id UUID NOT NULL REFERENCES flash_sale_items(id) ON DELETE CASCADE,
  correlation_id VARCHAR(36) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT user_id_not_empty CHECK (LENGTH(user_id) > 0),
  CONSTRAINT correlation_id_not_empty CHECK (LENGTH(correlation_id) > 0),
  CONSTRAINT purchases_user_item_unique UNIQUE (user_id, item_id)
);

-- Indexes for queries
CREATE INDEX IF NOT EXISTS idx_purchases_user_id 
ON purchases(user_id);

CREATE INDEX IF NOT EXISTS idx_purchases_item_id 
ON purchases(item_id);

CREATE INDEX IF NOT EXISTS idx_purchases_correlation_id 
ON purchases(correlation_id);

CREATE INDEX IF NOT EXISTS idx_purchases_created_at 
ON purchases(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_purchases_user_created 
ON purchases(user_id, created_at DESC);

-- ============================================================================
-- 2.3 CSRF TOKENS TABLE
-- ============================================================================
-- One-time CSRF tokens with expiry
-- Managed by Redis in production, stored here for archival

CREATE TABLE IF NOT EXISTS csrf_tokens (
  token VARCHAR(32) PRIMARY KEY,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT token_not_empty CHECK (LENGTH(token) > 0)
);

-- Index for expiry cleanup
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_expires_at 
ON csrf_tokens(expires_at);

-- ============================================================================
-- 2.4 AUDIT LOGS TABLE
-- ============================================================================
-- Compliance-ready immutable audit trail
-- Every action is logged for regulatory requirements (AU$1B fintech)

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  correlation_id VARCHAR(36) NOT NULL,
  action VARCHAR(100) NOT NULL,
  user_id VARCHAR(256),
  details JSONB NOT NULL DEFAULT '{}',
  success BOOLEAN NOT NULL DEFAULT true,
  
  CONSTRAINT correlation_id_not_empty CHECK (LENGTH(correlation_id) > 0),
  CONSTRAINT action_not_empty CHECK (LENGTH(action) > 0)
);

-- Indexes for queries and cleanup
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp 
ON audit_logs(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation_id 
ON audit_logs(correlation_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action 
ON audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id 
ON audit_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_success 
ON audit_logs(success, timestamp DESC);

-- ============================================================================
-- 2.5 RATE LIMIT REQUESTS TABLE
-- ============================================================================
-- Tracks requests for rate limit analytics
-- Managed by Redis in production, periodically synced here

CREATE TABLE IF NOT EXISTS rate_limit_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(256) NOT NULL,
  request_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT user_id_not_empty CHECK (LENGTH(user_id) > 0)
);

-- Index for queries
CREATE INDEX IF NOT EXISTS idx_rate_limit_requests_user_id_time 
ON rate_limit_requests(user_id, request_time DESC);

-- Periodic cleanup (remove older than 30 days)
-- Run via cron: DELETE FROM rate_limit_requests WHERE request_time < NOW() - INTERVAL '30 days';

-- ============================================================================
-- 3. CREATE INITIAL DATA
-- ============================================================================

-- This app only ever shows one flash-sale item, so treat the table as a
-- single row instead of matching seed data by name: collapse to the
-- oldest row (in case an older deploy's seed insert left a stale
-- differently-named duplicate behind), create it if the table is empty,
-- then sync its name/price to the current drop. `stock`/`original_stock`/
-- `version` are deliberately left untouched on an existing row so restarts
-- never resurrect depleted inventory - only a genuinely empty table gets
-- them, seeded from the app's STOCK env var (substituted into __STOCK__
-- below by initializeDatabase() before this script runs).
DELETE FROM flash_sale_items
WHERE id NOT IN (SELECT id FROM flash_sale_items ORDER BY created_at ASC LIMIT 1);

INSERT INTO flash_sale_items (name, price, stock, original_stock, version)
SELECT 'Nova Runner — Sunset Edition', 118.00, __STOCK__, __STOCK__, 0
WHERE NOT EXISTS (SELECT 1 FROM flash_sale_items);

UPDATE flash_sale_items
SET name = 'Nova Runner — Sunset Edition', price = 118.00;

-- ============================================================================
-- 4. CREATE VIEWS (Optional)
-- ============================================================================

-- View: Purchase summary by user
CREATE OR REPLACE VIEW v_purchases_by_user AS
SELECT 
  user_id,
  COUNT(*) as total_purchases,
  MAX(created_at) as last_purchase_at,
  MIN(created_at) as first_purchase_at
FROM purchases
GROUP BY user_id;

-- View: Recent audit activity
CREATE OR REPLACE VIEW v_recent_audit_activity AS
SELECT 
  timestamp,
  correlation_id,
  action,
  user_id,
  success,
  details,
  ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY timestamp DESC) as user_action_rank
FROM audit_logs
WHERE timestamp > NOW() - INTERVAL '24 hours';

-- ============================================================================
-- 5. GRANTS & PERMISSIONS
-- ============================================================================

-- Create application role (if not exists)
DO $$ 
BEGIN
  CREATE ROLE flash_sale_app LOGIN PASSWORD 'app_password';
EXCEPTION WHEN DUPLICATE_OBJECT THEN
  -- Role already exists
END
$$;

-- Grant permissions
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO flash_sale_app', current_database());
END
$$;
GRANT USAGE ON SCHEMA public TO flash_sale_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO flash_sale_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO flash_sale_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO flash_sale_app;

-- ============================================================================
-- 6. MAINTENANCE & CLEANUP PROCEDURES
-- ============================================================================

-- Procedure: Clean up expired CSRF tokens
CREATE OR REPLACE FUNCTION cleanup_expired_csrf_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM csrf_tokens WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Procedure: Clean up old audit logs (older than 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM audit_logs WHERE timestamp < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Procedure: Get system statistics
CREATE OR REPLACE FUNCTION get_system_stats()
RETURNS TABLE (
  total_purchases BIGINT,
  unique_users BIGINT,
  current_stock INTEGER,
  current_version INTEGER,
  total_audit_logs BIGINT,
  audit_logs_24h BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM purchases)::BIGINT,
    (SELECT COUNT(DISTINCT user_id) FROM purchases)::BIGINT,
    (SELECT stock FROM flash_sale_items LIMIT 1)::INTEGER,
    (SELECT version FROM flash_sale_items LIMIT 1)::INTEGER,
    (SELECT COUNT(*) FROM audit_logs)::BIGINT,
    (SELECT COUNT(*) FROM audit_logs WHERE timestamp > NOW() - INTERVAL '24 hours')::BIGINT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. VERIFICATION
-- ============================================================================

-- Verify all tables created
SELECT 
  tablename,
  schemaname
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Verify flash sale item exists
SELECT id, name, price, stock, original_stock, version, created_at
FROM flash_sale_items
LIMIT 1;

-- ============================================================================
-- END OF INITIALIZATION SCRIPT
-- ============================================================================
-- 
-- To use this script:
-- 1. Connect to PostgreSQL: psql postgresql://user:password@host:5432/flash_sale_dev
-- 2. Run script: \i init.sql
-- 3. Or via docker: docker exec flash-sale-postgres psql -U bookipi -d flash_sale_dev -f /docker-entrypoint-initdb.d/init.sql
--
-- ============================================================================