-- ============================================================================
-- CAREERNEXUS MIGRATION — ADMIN & RECRUITER ACCOUNTS PROVISIONING
-- File: supabase/migrations/20261116_admin_and_recruiter_credentials_provisioning.sql
-- Description:
--   1. Ensures company_id column exists on public.users referencing public.companies
--   2. Updates protect_user_role_and_status() so superuser/postgres can provision admin roles
--   3. Ensures cnexadmin@gmail.com and admin001@careernexus.com are confirmed in auth.users
--      with known password 'Admin@001X' and matching role = 'admin' in public.users
--   4. Ensures recruiter001@careernexus.com and zoho.recruiter@careernexus.com are confirmed
--      with role = 'recruiter', valid company_id (Zoho Corporation), and password 'Recruiter@001X'
-- ============================================================================

BEGIN;

-- 1. Ensure company_id column exists on public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- 2. Update protect_user_role_and_status() to permit postgres/service_role direct migrations
CREATE OR REPLACE FUNCTION public.protect_user_role_and_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Allow direct superuser / service / migration execution when auth.uid() is null
    IF current_user IN ('postgres', 'supabase_admin', 'service_role') AND auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.role::TEXT = 'admin' THEN
            IF (auth.uid() IS NULL OR public.get_user_role(auth.uid()) <> 'admin') THEN
                NEW.role := 'student';
            END IF;
        END IF;
        IF NEW.is_active IS NULL THEN
            NEW.is_active := TRUE;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF (NEW.role::TEXT IS DISTINCT FROM OLD.role::TEXT 
            OR NEW.is_active IS DISTINCT FROM OLD.is_active 
            OR NEW.status IS DISTINCT FROM OLD.status) THEN
            IF (auth.uid() IS NULL OR public.get_user_role(auth.uid()) <> 'admin') THEN
                RAISE EXCEPTION 'Unauthorized: Only administrators can modify roles, account activation, or status.';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- Backfill company_id for any users with matching company name
UPDATE public.users u
SET company_id = c.id
FROM public.companies c
WHERE LOWER(TRIM(u.company)) = LOWER(TRIM(c.name))
  AND u.company_id IS NULL;

-- 3. Provision / Confirm Admin: admin001@careernexus.com
DO $$
DECLARE
    v_admin_id UUID := '00000000-0000-0000-0004-000000000001';
    v_email TEXT := 'admin001@careernexus.com';
    v_pwd TEXT := 'Admin@001X';
    v_name TEXT := 'Dr. Rajeshwari Sundaram';
BEGIN
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at,
        confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
        v_admin_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        v_email,
        extensions.crypt(v_pwd, extensions.gen_salt('bf')),
        NOW(),
        '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb,
        jsonb_build_object('full_name', v_name, 'role', 'admin', 'email_verified', true),
        false,
        NOW(),
        NOW(),
        '', '', '', ''
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        encrypted_password = EXCLUDED.encrypted_password,
        email_confirmed_at = COALESCE(auth.users.email_confirmed_at, NOW()),
        raw_app_meta_data = EXCLUDED.raw_app_meta_data,
        raw_user_meta_data = EXCLUDED.raw_user_meta_data,
        updated_at = NOW();

    INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data, provider, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        v_admin_id,
        v_admin_id::text,
        jsonb_build_object('sub', v_admin_id::text, 'email', v_email, 'email_verified', true),
        'email',
        NOW(),
        NOW()
    )
    ON CONFLICT (provider_id, provider) DO UPDATE SET
        identity_data = EXCLUDED.identity_data,
        updated_at = NOW();

    INSERT INTO public.users (
        id, email, full_name, role, is_active, status, created_at, updated_at
    ) VALUES (
        v_admin_id,
        v_email,
        v_name,
        'admin',
        true,
        'active',
        NOW(),
        NOW()
    )
    ON CONFLICT (email) DO UPDATE SET
        role = 'admin',
        full_name = EXCLUDED.full_name,
        is_active = true,
        status = 'active',
        updated_at = NOW();
END $$;

-- 4. Provision / Confirm Admin: cnexadmin@gmail.com
DO $$
DECLARE
    v_cnex_id UUID := '00000000-0000-0000-0004-000000000002';
    v_email TEXT := 'cnexadmin@gmail.com';
    v_pwd TEXT := 'Admin@001X';
    v_name TEXT := 'CareerNexus Admin';
BEGIN
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at,
        confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
        v_cnex_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        v_email,
        extensions.crypt(v_pwd, extensions.gen_salt('bf')),
        NOW(),
        '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb,
        jsonb_build_object('full_name', v_name, 'role', 'admin', 'email_verified', true),
        false,
        NOW(),
        NOW(),
        '', '', '', ''
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        encrypted_password = EXCLUDED.encrypted_password,
        email_confirmed_at = COALESCE(auth.users.email_confirmed_at, NOW()),
        raw_app_meta_data = EXCLUDED.raw_app_meta_data,
        raw_user_meta_data = EXCLUDED.raw_user_meta_data,
        updated_at = NOW();

    INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data, provider, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        v_cnex_id,
        v_cnex_id::text,
        jsonb_build_object('sub', v_cnex_id::text, 'email', v_email, 'email_verified', true),
        'email',
        NOW(),
        NOW()
    )
    ON CONFLICT (provider_id, provider) DO UPDATE SET
        identity_data = EXCLUDED.identity_data,
        updated_at = NOW();

    INSERT INTO public.users (
        id, email, full_name, role, is_active, status, created_at, updated_at
    ) VALUES (
        v_cnex_id,
        v_email,
        v_name,
        'admin',
        true,
        'active',
        NOW(),
        NOW()
    )
    ON CONFLICT (email) DO UPDATE SET
        role = 'admin',
        full_name = EXCLUDED.full_name,
        is_active = true,
        status = 'active',
        updated_at = NOW();
END $$;

-- 5. Ensure Recruiter: recruiter001@careernexus.com linked to Zoho Corporation
DO $$
DECLARE
    v_recruiter_id UUID := '00000000-0000-0000-0003-000000000001';
    v_email TEXT := 'recruiter001@careernexus.com';
    v_pwd TEXT := 'Recruiter@001X';
    v_name TEXT := 'Vikram Singhania';
    v_company TEXT := 'Zoho Corporation';
    v_company_id UUID;
BEGIN
    SELECT id INTO v_company_id FROM public.companies WHERE name = v_company LIMIT 1;

    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at,
        confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
        v_recruiter_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        v_email,
        extensions.crypt(v_pwd, extensions.gen_salt('bf')),
        NOW(),
        '{"provider":"email","providers":["email"],"role":"recruiter"}'::jsonb,
        jsonb_build_object('full_name', v_name, 'role', 'recruiter', 'company', v_company, 'company_id', v_company_id, 'email_verified', true),
        false,
        NOW(),
        NOW(),
        '', '', '', ''
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        encrypted_password = EXCLUDED.encrypted_password,
        email_confirmed_at = COALESCE(auth.users.email_confirmed_at, NOW()),
        raw_app_meta_data = EXCLUDED.raw_app_meta_data,
        raw_user_meta_data = EXCLUDED.raw_user_meta_data,
        updated_at = NOW();

    INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data, provider, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        v_recruiter_id,
        v_recruiter_id::text,
        jsonb_build_object('sub', v_recruiter_id::text, 'email', v_email, 'email_verified', true),
        'email',
        NOW(),
        NOW()
    )
    ON CONFLICT (provider_id, provider) DO UPDATE SET
        identity_data = EXCLUDED.identity_data,
        updated_at = NOW();

    INSERT INTO public.users (
        id, email, full_name, role, company, company_id, is_active, status, created_at, updated_at
    ) VALUES (
        v_recruiter_id,
        v_email,
        v_name,
        'recruiter',
        v_company,
        v_company_id,
        true,
        'active',
        NOW(),
        NOW()
    )
    ON CONFLICT (email) DO UPDATE SET
        role = 'recruiter',
        full_name = EXCLUDED.full_name,
        company = v_company,
        company_id = v_company_id,
        is_active = true,
        status = 'active',
        updated_at = NOW();
END $$;

-- 6. Ensure Recruiter: zoho.recruiter@careernexus.com also has valid company_id and password
DO $$
DECLARE
    v_zoho_recruiter_id UUID := 'd48a2d08-63b2-4d1f-8e6b-29a611ab44a0';
    v_email TEXT := 'zoho.recruiter@careernexus.com';
    v_pwd TEXT := 'Recruiter@001X';
    v_company TEXT := 'Zoho Corporation';
    v_company_id UUID;
BEGIN
    SELECT id INTO v_company_id FROM public.companies WHERE name = v_company LIMIT 1;

    UPDATE auth.users
    SET encrypted_password = extensions.crypt(v_pwd, extensions.gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        raw_user_meta_data = raw_user_meta_data || jsonb_build_object('company_id', v_company_id, 'company', v_company, 'role', 'recruiter')
    WHERE id = v_zoho_recruiter_id;

    INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data, provider, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        v_zoho_recruiter_id,
        v_zoho_recruiter_id::text,
        jsonb_build_object('sub', v_zoho_recruiter_id::text, 'email', v_email, 'email_verified', true),
        'email',
        NOW(),
        NOW()
    )
    ON CONFLICT (provider_id, provider) DO UPDATE SET
        identity_data = EXCLUDED.identity_data,
        updated_at = NOW();

    UPDATE public.users
    SET company = v_company,
        company_id = v_company_id,
        role = 'recruiter',
        is_active = true,
        status = 'active'
    WHERE id = v_zoho_recruiter_id;
END $$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
