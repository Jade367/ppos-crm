-- ============================================================
-- Pocket Packet OS (PPOS) — Supabase Schema
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- 0. Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. Profiles (linked to Supabase Auth users)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','sales','ops','finance','factory')),
  avatar TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create a profile row when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'sales')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. Company Profile
-- ============================================================
CREATE TABLE company_profile (
  id SERIAL PRIMARY KEY,
  legal_entity_name TEXT DEFAULT '',
  vat_number TEXT DEFAULT '',
  vat_registered BOOLEAN DEFAULT false,
  pva_enabled BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default row
INSERT INTO company_profile (legal_entity_name, vat_number, vat_registered, pva_enabled)
VALUES ('Pocket Packet Pty Ltd', 'AU 12 345 678 901', true, false);

-- ============================================================
-- 3. Customers
-- ============================================================
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  company TEXT NOT NULL DEFAULT '',
  company_zh TEXT DEFAULT '',
  contact TEXT DEFAULT '',
  contact_zh TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  payment_terms TEXT DEFAULT 'cash' CHECK (payment_terms IN ('cash','net30','net60')),
  last_order TEXT DEFAULT '-',
  total_revenue NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive')),
  tags TEXT[] DEFAULT '{}',
  last_active_date TEXT,
  social_app JSONB,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. Purchased Items
-- ============================================================
CREATE TABLE purchased_items (
  id SERIAL PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sku TEXT DEFAULT '',
  product TEXT DEFAULT '',
  spec TEXT DEFAULT '',
  last_price NUMERIC DEFAULT 0,
  plate_fee TEXT DEFAULT 'unpaid',
  pcs_per_carton INTEGER DEFAULT 0,
  carton_l NUMERIC DEFAULT 0,
  carton_w NUMERIC DEFAULT 0,
  carton_h NUMERIC DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_purchased_items_customer ON purchased_items(customer_id);

-- ============================================================
-- 5. Quotes
-- ============================================================
CREATE TABLE quotes (
  id SERIAL PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  date TEXT,
  valid_until TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','expired')),
  items JSONB DEFAULT '[]',
  note TEXT DEFAULT '',
  shipping TEXT DEFAULT '',
  tax TEXT DEFAULT '',
  cost_warnings JSONB DEFAULT '[]',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_quotes_customer ON quotes(customer_id);

-- ============================================================
-- 6. Orders
-- ============================================================
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  quote_id INTEGER,
  date TEXT,
  stage TEXT DEFAULT 'Order_Placed',
  subtotal_amount NUMERIC DEFAULT 0,
  tax_rate NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total_amount_inc_tax NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  gateway_fee NUMERIC DEFAULT 0,
  deposit_amount NUMERIC DEFAULT 0,
  balance_amount NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid',
  estimated_completion_date TEXT,
  items JSONB DEFAULT '[]',
  note TEXT DEFAULT '',
  stage_history JSONB DEFAULT '[]',
  cost_snapshot JSONB,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_orders_customer ON orders(customer_id);

-- ============================================================
-- 7. Products
-- ============================================================
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  sku TEXT DEFAULT '',
  name TEXT DEFAULT '',
  category TEXT DEFAULT '',
  material TEXT DEFAULT '',
  cost NUMERIC DEFAULT 0,
  price NUMERIC DEFAULT 0,
  plate_fee NUMERIC DEFAULT 0,
  pcs_per_carton INTEGER DEFAULT 0,
  carton_length NUMERIC DEFAULT 0,
  carton_width NUMERIC DEFAULT 0,
  carton_height NUMERIC DEFAULT 0,
  hs_code TEXT DEFAULT '',
  material_composition TEXT DEFAULT '',
  net_weight_per_carton NUMERIC DEFAULT 0,
  gross_weight_per_carton NUMERIC DEFAULT 0,
  factory_id TEXT DEFAULT '',
  factory_name TEXT DEFAULT '',
  currency TEXT DEFAULT 'RMB',
  cost_history JSONB DEFAULT '[]',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 8. Factories
-- ============================================================
CREATE TABLE factories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  name_en TEXT DEFAULT '',
  contact TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  location TEXT DEFAULT '',
  specialty TEXT DEFAULT '',
  categories TEXT[] DEFAULT '{}',
  capacity TEXT DEFAULT '',
  lead_time TEXT DEFAULT '',
  status TEXT DEFAULT 'active' CHECK (status IN ('active','paused','pending')),
  rating INTEGER DEFAULT 0,
  note TEXT DEFAULT '',
  start_date TEXT,
  payment_terms TEXT DEFAULT '',
  moq TEXT DEFAULT '',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 9. Materials
-- ============================================================
CREATE TABLE materials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  name_en TEXT DEFAULT '',
  spec TEXT DEFAULT '',
  unit TEXT DEFAULT '',
  price NUMERIC DEFAULT 0,
  last_price NUMERIC DEFAULT 0,
  supplier TEXT DEFAULT '',
  last_update TEXT,
  trend TEXT DEFAULT 'stable' CHECK (trend IN ('up','down','stable')),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 10. Price Impact Reports
-- ============================================================
CREATE TABLE price_impacts (
  id TEXT PRIMARY KEY,
  date TEXT,
  product_sku TEXT DEFAULT '',
  product_name TEXT DEFAULT '',
  old_cost NUMERIC DEFAULT 0,
  new_cost NUMERIC DEFAULT 0,
  delta NUMERIC DEFAULT 0,
  affected_orders JSONB DEFAULT '[]',
  affected_quotes JSONB DEFAULT '[]',
  affected_purchased_items JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 11. Row Level Security (RLS)
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchased_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE factories ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_impacts ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, update own; admin can update any profile
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- All business tables: authenticated users have full access (same company)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['company_profile','customers','purchased_items','quotes','orders','products','factories','materials','price_impacts']
  LOOP
    EXECUTE format('CREATE POLICY "auth_select_%s" ON %I FOR SELECT USING (auth.role() = ''authenticated'')', tbl, tbl);
    EXECUTE format('CREATE POLICY "auth_insert_%s" ON %I FOR INSERT WITH CHECK (auth.role() = ''authenticated'')', tbl, tbl);
    EXECUTE format('CREATE POLICY "auth_update_%s" ON %I FOR UPDATE USING (auth.role() = ''authenticated'')', tbl, tbl);
    EXECUTE format('CREATE POLICY "auth_delete_%s" ON %I FOR DELETE USING (auth.role() = ''authenticated'')', tbl, tbl);
  END LOOP;
END $$;

-- ============================================================
-- 12. Helper: updated_at auto-update trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER company_profile_updated_at BEFORE UPDATE ON company_profile FOR EACH ROW EXECUTE FUNCTION update_updated_at();
