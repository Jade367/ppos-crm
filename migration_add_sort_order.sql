-- ============================================================
-- 添加 sort_order 列到 products 表
-- 用于支持产品手动排序（拖拽调整顺序）
-- 在 Supabase Dashboard > SQL Editor 中执行
-- ============================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT NULL;

-- 可选：为现有产品按 SKU 初始化排序值
-- UPDATE products SET sort_order = sub.rn FROM (
--   SELECT id, ROW_NUMBER() OVER (ORDER BY category, sku) - 1 AS rn FROM products WHERE deleted_at IS NULL
-- ) sub WHERE products.id = sub.id;
