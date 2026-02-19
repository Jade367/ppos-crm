-- ============================================================
-- 乔总客户 + 利润报表订单 + 产品导入 (一次性全部执行)
-- 来源: Profit Statement PP-E9HE7Z (2026-02-08)
-- 在 Supabase Dashboard > SQL Editor 中执行
-- ============================================================

-- ==================== 1. 创建乔总客户 ====================
INSERT INTO customers (id, company, company_zh, contact, contact_zh, phone, address, payment_terms, total_revenue, status, tags, last_active_date, last_order)
VALUES (
  'C-QIAO-001',
  'Mr. Qiao Client',
  '乔总',
  'Mr. Qiao',
  '乔总',
  '',
  '',
  'net30',
  263758.00,
  'active',
  ARRAY['VIP'],
  '2026-02-08',
  '2026-02-08'
)
ON CONFLICT (id) DO UPDATE SET
  total_revenue = EXCLUDED.total_revenue,
  last_active_date = EXCLUDED.last_active_date,
  last_order = EXCLUDED.last_order,
  updated_at = now();

-- ==================== 2. 导入产品 (13款) ====================
INSERT INTO products (id, sku, name, category, material, cost, price, plate_fee, pcs_per_carton, carton_length, carton_width, carton_height, factory_id, factory_name, currency, hs_code, material_composition, net_weight_per_carton, gross_weight_per_carton, cost_history)
VALUES
  ('P-001', 'PP-001', '1号炸鸡盒 800ML No.1 Chicken Box / 800ML', 'Food Box', '白卡纸 White Card', 0.35, 0.36, 0, 200, 540, 310, 225, '', '', 'RMB', '4819400000', '白卡纸 White Card', 3.92, 4.36, '[{"date": "2026-02-08", "cost": 0.35, "note": "Profit Statement PP-E9HE7Z"}]'::jsonb),
  ('P-002', 'PP-002', '5号炸鸡盒 1080ML No.5 Chicken Box / 1080ML', 'Food Box', '白卡纸 White Card', 0.39, 0.44, 0, 200, 540, 300, 380, '', '', 'RMB', '4819400000', '白卡纸 White Card', 4.79, 5.32, '[{"date": "2026-02-08", "cost": 0.39, "note": "Profit Statement PP-E9HE7Z"}]'::jsonb),
  ('P-003', 'PP-003', '8号炸鸡盒 1400ML No.8 Chicken Box / 1400ML', 'Food Box', '白卡纸 White Card', 0.46, 0.46, 0, 200, 550, 290, 380, '', '', 'RMB', '4819400000', '白卡纸 White Card', 5.81, 6.46, '[{"date": "2026-02-08", "cost": 0.46, "note": "Profit Statement PP-E9HE7Z"}]'::jsonb),
  ('P-004', 'PP-004', '小号保温袋(28x22x13) Small Insulated Bag (28x22x13)', 'Bag', '无纺布 Non-woven Fabric', 0.58, 0.60, 0, 200, 470, 450, 280, '', '', 'RMB', '6305390000', '无纺布 Non-woven Fabric', 6.84, 7.60, '[{"date": "2026-02-08", "cost": 0.58, "note": "Profit Statement PP-E9HE7Z"}]'::jsonb),
  ('P-005', 'PP-005', '中号保温袋(35x26x19) Medium Insulated Bag (35x26x19)', 'Bag', '无纺布 Non-woven Fabric', 0.76, 0.76, 0, 200, 560, 530, 280, '', '', 'RMB', '6305390000', '无纺布 Non-woven Fabric', 10.53, 11.70, '[{"date": "2026-02-08", "cost": 0.76, "note": "Profit Statement PP-E9HE7Z"}]'::jsonb),
  ('P-006', 'PP-006', '大号保温袋(38x30x20) Large Insulated Bag (38x30x20)', 'Bag', '无纺布 Non-woven Fabric', 0.91, 0.98, 0, 200, 560, 310, 500, '', '', 'RMB', '6305390000', '无纺布 Non-woven Fabric', 12.42, 13.80, '[{"date": "2026-02-08", "cost": 0.91, "note": "Profit Statement PP-E9HE7Z"}]'::jsonb),
  ('P-007', 'PP-007', '带扣打包盒 500ML Takeaway Container / 500ML', 'Container', 'PP塑料 PP Plastic', 0.56, 0.59, 0, 300, 390, 390, 550, '', '', 'RMB', '3924100000', 'PP塑料 PP Plastic', 9.00, 10.00, '[{"date": "2026-02-08", "cost": 0.56, "note": "Profit Statement PP-E9HE7Z"}]'::jsonb),
  ('P-008', 'PP-008', '带扣打包盒 650ML Takeaway Container / 650ML', 'Container', 'PP塑料 PP Plastic', 0.59, 0.63, 0, 298, 390, 390, 560, '', '', 'RMB', '3924100000', 'PP塑料 PP Plastic', 10.35, 11.50, '[{"date": "2026-02-08", "cost": 0.59, "note": "Profit Statement PP-E9HE7Z"}]'::jsonb),
  ('P-009', 'PP-009', '带扣打包盒 850ML Takeaway Container / 850ML', 'Container', 'PP塑料 PP Plastic', 0.63, 0.65, 0, 292, 390, 390, 565, '', '', 'RMB', '3924100000', 'PP塑料 PP Plastic', 11.25, 12.50, '[{"date": "2026-02-08", "cost": 0.63, "note": "Profit Statement PP-E9HE7Z"}]'::jsonb),
  ('P-010', 'PP-010', '小手提披萨盒(23x17x7) Small Pizza Box (23x17x7)', 'Food Box', '瓦楞纸 Corrugated Paper', 1.10, 1.26, 0, 100, 615, 530, 240, '', '', 'RMB', '4819100000', '瓦楞纸 Corrugated Paper', 10.62, 11.80, '[{"date": "2026-02-08", "cost": 1.10, "note": "Profit Statement PP-E9HE7Z"}]'::jsonb),
  ('P-011', 'PP-011', '大手提披萨盒(30x34x7) Large Pizza Box (30x34x7)', 'Food Box', '瓦楞纸 Corrugated Paper', 1.60, 1.68, 0, 100, 890, 715, 240, '', '', 'RMB', '4819100000', '瓦楞纸 Corrugated Paper', 20.70, 23.00, '[{"date": "2026-02-08", "cost": 1.60, "note": "Profit Statement PP-E9HE7Z"}]'::jsonb),
  ('P-012', 'PP-012', '26oz炒面盒 26oz Noodle Box', 'Food Box', '白卡纸 White Card', 0.54, 0.54, 0, 1000, 615, 500, 60, '', '', 'RMB', '4819400000', '白卡纸 White Card', 17.10, 19.00, '[{"date": "2026-02-08", "cost": 0.54, "note": "Profit Statement PP-E9HE7Z"}]'::jsonb),
  ('P-018', 'PP-018', '3号炸鸡盒 2000ML No.3 Chicken Box / 2000ML', 'Food Box', '白卡纸 White Card', 0.52, 0.52, 0, 200, 490, 350, 470, '', '', 'RMB', '4819400000', '白卡纸 White Card', 7.65, 8.50, '[{"date": "2026-02-08", "cost": 0.52, "note": "Profit Statement PP-E9HE7Z"}]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  sku = EXCLUDED.sku,
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  material = EXCLUDED.material,
  cost = EXCLUDED.cost,
  price = EXCLUDED.price,
  cost_history = EXCLUDED.cost_history,
  updated_at = now();

-- ==================== 3. 乔总的购买产品列表 (purchased_items) ====================
-- 这些会显示在乔总客户详情 > 购买记录（客户常购产品清单）
INSERT INTO purchased_items (customer_id, sku, product, spec, last_price, plate_fee, pcs_per_carton, carton_l, carton_w, carton_h)
VALUES
  ('C-QIAO-001', 'PP-001', '1号炸鸡盒 / 800ML', '185x130x55mm', 0.36, 'paid', 200, 540, 310, 225),
  ('C-QIAO-001', 'PP-018', '3号炸鸡盒 / 2000ML', '250x180x80mm', 0.52, 'paid', 200, 490, 350, 470),
  ('C-QIAO-001', 'PP-002', '5号炸鸡盒 / 1080ML', '210x148x65mm', 0.44, 'paid', 200, 540, 300, 380),
  ('C-QIAO-001', 'PP-003', '8号炸鸡盒 / 1400ML', '235x165x70mm', 0.46, 'paid', 200, 550, 290, 380),
  ('C-QIAO-001', 'PP-012', '26oz 炒面盒', '120x100x65mm', 0.54, 'unpaid', 1000, 615, 500, 60),
  ('C-QIAO-001', 'PP-004', '小号保温袋 (28×22×13)', '280x220x130mm', 0.60, 'paid', 200, 470, 450, 280),
  ('C-QIAO-001', 'PP-005', '中号保温袋 (35×26×19)', '350x260x190mm', 0.76, 'paid', 200, 560, 530, 280),
  ('C-QIAO-001', 'PP-006', '大号保温袋 (38×30×20)', '380x300x200mm', 0.98, 'paid', 200, 560, 310, 500),
  ('C-QIAO-001', 'PP-007', '带扣打包盒 / 500ML', '175x120x50mm', 0.59, 'paid', 300, 390, 390, 550),
  ('C-QIAO-001', 'PP-008', '带扣打包盒 / 650ML', '195x135x55mm', 0.63, 'paid', 298, 390, 390, 560),
  ('C-QIAO-001', 'PP-009', '带扣打包盒 / 850ML', '210x148x65mm', 0.65, 'paid', 292, 390, 390, 565),
  ('C-QIAO-001', 'PP-010', '小手提披萨盒 (23×17×7)', '230x170x70mm', 1.26, 'paid', 100, 615, 530, 240),
  ('C-QIAO-001', 'PP-011', '大手提披萨盒 (30×34×7)', '300x340x70mm', 1.68, 'paid', 100, 890, 715, 240);

-- ==================== 4. 创建订单（利润报表 PP-E9HE7Z） ====================
INSERT INTO orders (id, customer_id, date, stage, subtotal_amount, tax_rate, tax_amount, total_amount_inc_tax, total_amount, gateway_fee, deposit_amount, balance_amount, payment_status, note, items, stage_history)
VALUES (
  'ORD-QIAO-001',
  'C-QIAO-001',
  '2026-02-08',
  'Delivered',
  263758.00,
  0.00,
  0.00,
  263758.00,
  263758.00,
  0.00,
  263758.00,
  0.00,
  'fully_paid',
  '利润报表 Profit Statement PP-E9HE7Z | 净利润 Net Profit: ¥13,545.00 | 平均毛利率 Avg Margin: 5.1%',
  '[
    {"sku": "PP-001", "product": "1号炸鸡盒 / 800ML", "qty": 40000, "unitPrice": 0.36},
    {"sku": "PP-018", "product": "3号炸鸡盒 / 2000ML", "qty": 5000, "unitPrice": 0.52},
    {"sku": "PP-002", "product": "5号炸鸡盒 / 1080ML", "qty": 78600, "unitPrice": 0.44},
    {"sku": "PP-003", "product": "8号炸鸡盒 / 1400ML", "qty": 25000, "unitPrice": 0.46},
    {"sku": "PP-012", "product": "26oz 炒面盒", "qty": 20000, "unitPrice": 0.54},
    {"sku": "PP-004", "product": "小号保温袋 (28×22×13)", "qty": 35200, "unitPrice": 0.60},
    {"sku": "PP-005", "product": "中号保温袋 (35×26×19)", "qty": 45000, "unitPrice": 0.76},
    {"sku": "PP-006", "product": "大号保温袋 (38×30×20)", "qty": 34800, "unitPrice": 0.98},
    {"sku": "PP-007", "product": "带扣打包盒 / 500ML", "qty": 45000, "unitPrice": 0.59},
    {"sku": "PP-008", "product": "带扣打包盒 / 650ML", "qty": 50000, "unitPrice": 0.63},
    {"sku": "PP-009", "product": "带扣打包盒 / 850ML", "qty": 20000, "unitPrice": 0.65},
    {"sku": "PP-010", "product": "小手提披萨盒 (23×17×7)", "qty": 10000, "unitPrice": 1.26},
    {"sku": "PP-011", "product": "大手提披萨盒 (30×34×7)", "qty": 10000, "unitPrice": 1.68}
  ]'::jsonb,
  '[{"stage": "Order_Placed", "date": "2026-02-08", "by": "Admin"}, {"stage": "Delivered", "date": "2026-02-08", "by": "System - Profit Statement Import"}]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  items = EXCLUDED.items,
  total_amount = EXCLUDED.total_amount,
  subtotal_amount = EXCLUDED.subtotal_amount,
  total_amount_inc_tax = EXCLUDED.total_amount_inc_tax,
  payment_status = EXCLUDED.payment_status,
  note = EXCLUDED.note,
  stage = EXCLUDED.stage,
  stage_history = EXCLUDED.stage_history,
  updated_at = now();

-- ==================== 完成 ====================
-- 导入完成后刷新 PPOS 系统，你会看到:
-- ✅ 客户列表中出现「乔总」(ID: C-QIAO-001, VIP)
-- ✅ 产品列表中有 13 款产品 (PP-001 ~ PP-018)
-- ✅ 乔总客户详情中有 13 个常购产品
-- ✅ 乔总有 1 笔已交付订单 (ORD-QIAO-001)，总额 ¥263,758.00
-- ✅ 订单状态: 已交付 (Delivered) + 已全额支付 (fully_paid)
