-- ============================================================
-- Migration: Factory Portal - Add factory assignment to orders
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add factory assignment columns to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS factory_id TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS factory_name TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS production_note TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS production_progress INTEGER DEFAULT 0;

-- 2. Add linked_factory_id to profiles (so factory user sees only their orders)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linked_factory_id TEXT DEFAULT '';

-- 3. Index for faster factory order queries
CREATE INDEX IF NOT EXISTS idx_orders_factory ON orders(factory_id);

-- Done! Now factory users can be linked to a specific factory,
-- and orders can be assigned to factories.
