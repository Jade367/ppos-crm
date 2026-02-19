-- ============================================================
-- ZEN London 产品导入 (18 products)
-- 在 Supabase Dashboard > SQL Editor 中执行
-- ============================================================

INSERT INTO products (id, sku, name, category, material, cost, price, plate_fee, pcs_per_carton, carton_length, carton_width, carton_height, factory_id, factory_name, currency, hs_code, material_composition, net_weight_per_carton, gross_weight_per_carton, cost_history)
VALUES
  ('P-001', 'PP-001', '1号炸鸡盒 800ML No.1 Chicken Box / 800ML', 'Food Box', '白卡纸 White Card', 0.35, 0.36, 0, 200, 540, 310, 225, '', '', 'RMB', '4819400000', '白卡纸 White Card', 3.92, 4.36, '[{"date": "2026-02-08", "cost": 0.35, "note": "Profit Statement RMB\u6210\u672c"}]'::jsonb),
  ('P-002', 'PP-002', '5号炸鸡盒 1080ML No.5 Chicken Box / 1080ML', 'Food Box', '白卡纸 White Card', 0.39, 0.44, 0, 200, 540, 300, 380, '', '', 'RMB', '4819400000', '白卡纸 White Card', 4.79, 5.32, '[{"date": "2026-02-08", "cost": 0.39, "note": "Profit Statement RMB\u6210\u672c"}]'::jsonb),
  ('P-003', 'PP-003', '8号炸鸡盒 1400ML No.8 Chicken Box / 1400ML', 'Food Box', '白卡纸 White Card', 0.46, 0.46, 0, 200, 550, 290, 380, '', '', 'RMB', '4819400000', '白卡纸 White Card', 5.81, 6.46, '[{"date": "2026-02-08", "cost": 0.46, "note": "Profit Statement RMB\u6210\u672c"}]'::jsonb),
  ('P-004', 'PP-004', '小号保温袋(28x22x13) Small Insulated Bag (28x22x13)', 'Bag', '无纺布 Non-woven Fabric', 0.58, 0.6, 0, 200, 470, 450, 280, '', '', 'RMB', '6305390000', '无纺布 Non-woven Fabric', 6.84, 7.6, '[{"date": "2026-02-08", "cost": 0.58, "note": "Profit Statement RMB\u6210\u672c"}]'::jsonb),
  ('P-005', 'PP-005', '中号保温袋(35x26x19) Medium Insulated Bag (35x26x19)', 'Bag', '无纺布 Non-woven Fabric', 0.76, 0.76, 0, 200, 560, 530, 280, '', '', 'RMB', '6305390000', '无纺布 Non-woven Fabric', 10.53, 11.7, '[{"date": "2026-02-08", "cost": 0.76, "note": "Profit Statement RMB\u6210\u672c"}]'::jsonb),
  ('P-006', 'PP-006', '大号保温袋(38x30x20) Large Insulated Bag (38x30x20)', 'Bag', '无纺布 Non-woven Fabric', 0.91, 0.98, 0, 200, 560, 310, 500, '', '', 'RMB', '6305390000', '无纺布 Non-woven Fabric', 12.42, 13.8, '[{"date": "2026-02-08", "cost": 0.91, "note": "Profit Statement RMB\u6210\u672c"}]'::jsonb),
  ('P-007', 'PP-007', '带扣打包盒 500ML Takeaway Container / 500ML', 'Container', 'PP塑料 PP Plastic', 0.56, 0.59, 0, 300, 390, 390, 550, '', '', 'RMB', '3924100000', 'PP塑料 PP Plastic', 9.0, 10.0, '[{"date": "2026-02-08", "cost": 0.56, "note": "Profit Statement RMB\u6210\u672c"}]'::jsonb),
  ('P-008', 'PP-008', '带扣打包盒 650ML Takeaway Container / 650ML', 'Container', 'PP塑料 PP Plastic', 0.59, 0.63, 0, 298, 390, 390, 560, '', '', 'RMB', '3924100000', 'PP塑料 PP Plastic', 10.35, 11.5, '[{"date": "2026-02-08", "cost": 0.59, "note": "Profit Statement RMB\u6210\u672c"}]'::jsonb),
  ('P-009', 'PP-009', '带扣打包盒 850ML Takeaway Container / 850ML', 'Container', 'PP塑料 PP Plastic', 0.63, 0.65, 0, 292, 390, 390, 565, '', '', 'RMB', '3924100000', 'PP塑料 PP Plastic', 11.25, 12.5, '[{"date": "2026-02-08", "cost": 0.63, "note": "Profit Statement RMB\u6210\u672c"}]'::jsonb),
  ('P-010', 'PP-010', '小手提披萨盒(23x17x7) Small Pizza Box (23x17x7)', 'Food Box', '瓦楞纸 Corrugated Paper', 1.1, 1.26, 0, 100, 615, 530, 240, '', '', 'RMB', '4819100000', '瓦楞纸 Corrugated Paper', 10.62, 11.8, '[{"date": "2026-02-08", "cost": 1.1, "note": "Profit Statement RMB\u6210\u672c"}]'::jsonb),
  ('P-011', 'PP-011', '大手提披萨盒(30x34x7) Large Pizza Box (30x34x7)', 'Food Box', '瓦楞纸 Corrugated Paper', 1.6, 1.68, 0, 100, 890, 715, 240, '', '', 'RMB', '4819100000', '瓦楞纸 Corrugated Paper', 20.7, 23.0, '[{"date": "2026-02-08", "cost": 1.6, "note": "Profit Statement RMB\u6210\u672c"}]'::jsonb),
  ('P-012', 'PP-012', '26oz炒面盒 26oz Noodle Box', 'Food Box', '白卡纸 White Card', 0.54, 0.54, 0, 1000, 615, 500, 60, '', '', 'RMB', '4819400000', '白卡纸 White Card', 17.1, 19.0, '[{"date": "2026-02-08", "cost": 0.54, "note": "Profit Statement RMB\u6210\u672c"}]'::jsonb),
  ('P-013', 'PP-013', '包装标签(50x50mm) Packaging Label (50x50mm)', 'Label', '铜版纸 Coated Paper', 0.012, 0.0162, 0, 0, 0, 0, 0, '', '', 'RMB', '4821100000', '铜版纸 Coated Paper', 0, 0, '[{"date": "2026-02-13", "cost": 0.012, "note": "ZEN London Invoice RMB\u6210\u672c"}]'::jsonb),
  ('P-014', 'PP-014', '包装标签(60x60mm) Packaging Label (60x60mm)', 'Label', '铜版纸 Coated Paper', 0.012, 0.0162, 0, 0, 0, 0, 0, '', '', 'RMB', '4821100000', '铜版纸 Coated Paper', 0, 0, '[{"date": "2026-02-13", "cost": 0.012, "note": "ZEN London Invoice RMB\u6210\u672c"}]'::jsonb),
  ('P-015', 'PP-015', '包装标签(180x40mm) Packaging Label (180x40mm)', 'Label', '铜版纸 Coated Paper', 0.012, 0.0162, 0, 0, 0, 0, 0, '', '', 'RMB', '4821100000', '铜版纸 Coated Paper', 0, 0, '[{"date": "2026-02-13", "cost": 0.012, "note": "ZEN London Invoice RMB\u6210\u672c"}]'::jsonb),
  ('P-016', 'PP-016', '腰封(430x80mm) Waistband (430x80mm)', 'Label', '铜版纸 Coated Paper', 0.084, 0.1134, 0, 0, 0, 0, 0, '', '', 'RMB', '4821100000', '铜版纸 Coated Paper', 0, 0, '[{"date": "2026-02-13", "cost": 0.084, "note": "ZEN London Invoice RMB\u6210\u672c"}]'::jsonb),
  ('P-017', 'PP-017', '吸油纸 Oil-absorbing Paper', 'Accessory', '吸油纸 Oil-absorbing Paper', 0.048, 0.0648, 0, 0, 360, 350, 250, '', '', 'RMB', '4819400000', '吸油纸 Oil-absorbing Paper', 0, 0, '[{"date": "2026-02-13", "cost": 0.048, "note": "ZEN London Invoice RMB\u6210\u672c"}]'::jsonb),
  ('P-018', 'PP-018', '3号炸鸡盒 2000ML No.3 Chicken Box / 2000ML', 'Food Box', '白卡纸 White Card', 0.52, 0.52, 0, 200, 490, 350, 470, '', '', 'RMB', '4819400000', '白卡纸 White Card', 7.65, 8.5, '[{"date": "2026-02-08", "cost": 0.52, "note": "Profit Statement RMB\u6210\u672c"}]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  sku = EXCLUDED.sku,
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  material = EXCLUDED.material,
  cost = EXCLUDED.cost,
  price = EXCLUDED.price,
  plate_fee = EXCLUDED.plate_fee,
  pcs_per_carton = EXCLUDED.pcs_per_carton,
  carton_length = EXCLUDED.carton_length,
  carton_width = EXCLUDED.carton_width,
  carton_height = EXCLUDED.carton_height,
  hs_code = EXCLUDED.hs_code,
  material_composition = EXCLUDED.material_composition,
  net_weight_per_carton = EXCLUDED.net_weight_per_carton,
  gross_weight_per_carton = EXCLUDED.gross_weight_per_carton,
  cost_history = EXCLUDED.cost_history,
  updated_at = now();