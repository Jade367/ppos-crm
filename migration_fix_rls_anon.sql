-- ============================================================
-- 修复 RLS 策略: 允许匿名用户 (anon) 访问所有业务表
-- 因为使用自管理认证，不走 Supabase Auth，
-- 所以 auth.role() 返回 'anon' 而不是 'authenticated'
-- 在 Supabase Dashboard > SQL Editor 中执行
-- ============================================================

-- ========== 删除旧的 authenticated-only 策略 ==========
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['company_profile','customers','purchased_items','quotes','orders','products','factories','materials','price_impacts']
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "auth_select_%s" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "auth_insert_%s" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "auth_update_%s" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "auth_delete_%s" ON %I', tbl, tbl);
    END LOOP;
END $$;

-- ========== 创建新的开放策略 (允许所有人访问) ==========
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['company_profile','customers','purchased_items','quotes','orders','products','factories','materials','price_impacts']
    LOOP
        EXECUTE format('CREATE POLICY "allow_select_%s" ON %I FOR SELECT USING (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY "allow_insert_%s" ON %I FOR INSERT WITH CHECK (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY "allow_update_%s" ON %I FOR UPDATE USING (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY "allow_delete_%s" ON %I FOR DELETE USING (true)', tbl, tbl);
    END LOOP;
END $$;

-- ========== 验证 ==========
-- 执行后可以用这个查询检查:
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
