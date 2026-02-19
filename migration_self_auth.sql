-- ============================================================
-- 迁移: 自管理认证系统 (不依赖 Supabase Auth)
-- 在 Supabase Dashboard > SQL Editor 中执行
-- ============================================================

-- 1. 添加 password_hash 列
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT '';

-- 2. 移除 auth.users 外键约束 (如果存在)
-- 先查找约束名然后删除
DO $$
DECLARE
    fk_name TEXT;
BEGIN
    SELECT constraint_name INTO fk_name
    FROM information_schema.table_constraints
    WHERE table_name = 'profiles'
      AND constraint_type = 'FOREIGN KEY'
      AND table_schema = 'public'
    LIMIT 1;

    IF fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT %I', fk_name);
        RAISE NOTICE 'Dropped foreign key constraint: %', fk_name;
    ELSE
        RAISE NOTICE 'No foreign key constraint found on profiles';
    END IF;
END $$;

-- 3. 更新 RLS 策略: 允许匿名用户查询和插入 profiles (用于登录和创建账号)
-- 先删除旧策略
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;

-- 新策略: 所有人都可以读取 profiles (用于登录验证)
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);

-- 新策略: 所有人都可以插入 profiles (用于创建账号)
CREATE POLICY "profiles_insert_all" ON profiles FOR INSERT WITH CHECK (true);

-- 新策略: 所有人都可以更新 profiles (管理员改角色等)
CREATE POLICY "profiles_update_all" ON profiles FOR UPDATE USING (true);

-- 4. 删除旧的 auth trigger (不再需要)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 5. 创建第一个管理员账号 (密码: admin123)
-- SHA-256 hash of "admin123_ppos_salt_2026" = 需要在浏览器中计算
-- 可以先不插入，通过页面上的初始化流程创建
-- 或者直接用下面的方式创建:
-- INSERT INTO profiles (id, username, display_name, email, role, password_hash)
-- VALUES (gen_random_uuid(), 'admin', 'Admin', 'admin@ppos.local', 'admin', '这里填hash值')
-- ON CONFLICT (username) DO NOTHING;
