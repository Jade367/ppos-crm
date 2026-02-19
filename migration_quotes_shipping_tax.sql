-- Migration: Add shipping and tax columns to quotes table
-- These columns were missing, causing quote inserts to fail silently
-- (Supabase/PostgREST returns error for unknown columns, fallback only saved to local state)

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS shipping TEXT DEFAULT '';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS tax TEXT DEFAULT '';
