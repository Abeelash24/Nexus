-- ============================================================================
-- CAREERNEXUS MIGRATION — PHASE 3: AUTH & RBAC HARDENING
-- File: supabase/migrations/20261014_phase3_auth_rbac_hardening.sql
-- Description: Hardens role assignment on signup, prevents public self-escalation
--              to admin/recruiter, preserves automatic student/alumni profile
--              provisioning, and provides account status validation helpers.
-- ============================================================================

BEGIN;

-- 1. Hardened Profile Provisioning Trigger on auth.users
-- Merges Phase 3 RBAC protections with complete student profile provisioning
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_raw_role TEXT;
    v_role user_role;
    v_full_name TEXT;
    v_username TEXT;
    v_department TEXT;
    v_company TEXT;
    v_avatar TEXT;
    v_caller_role TEXT;
BEGIN
    -- Read raw role from user metadata
    v_raw_role := LOWER(COALESCE(new.raw_user_meta_data->>'role', 'student'));

    -- Determine if the caller is an active administrator creating a user
    SELECT role::text INTO v_caller_role 
    FROM public.users 
    WHERE id = auth.uid();

    -- Role Escalation Protection:
    -- Only an authenticated administrator can assign 'admin' or 'recruiter' roles.
    -- Public self-signups attempting to claim 'admin' or 'recruiter' are forced to 'student'.
    IF v_raw_role IN ('admin', 'recruiter') THEN
        IF v_caller_role = 'admin' THEN
            v_role := v_raw_role::user_role;
        ELSE
            v_role := 'student'::user_role;
        END IF;
    ELSIF v_raw_role = 'alumni' THEN
        v_role := 'alumni'::user_role;
    ELSE
        v_role := 'student'::user_role;
    END IF;

    -- Extract metadata fields with safe fallbacks
    v_full_name := COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
    v_username := COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
    v_department := COALESCE(new.raw_user_meta_data->>'department', 'Computer Science & Engineering');
    v_company := COALESCE(new.raw_user_meta_data->>'company', '');
    v_avatar := COALESCE(new.raw_user_meta_data->>'avatar_url', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80');

    -- Insert or update record in public.users
    INSERT INTO public.users (
        id,
        username,
        email,
        full_name,
        role,
        avatar_url,
        department,
        company,
        is_active,
        status,
        created_at,
        updated_at
    ) VALUES (
        new.id,
        v_username,
        new.email,
        v_full_name,
        v_role,
        v_avatar,
        v_department,
        v_company,
        TRUE,
        'active',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = NOW();

    -- Automatically provision role-specific child profile record
    IF v_role = 'student' THEN
        INSERT INTO public.students (
            user_id,
            full_name,
            email,
            department,
            roll_number,
            profile_photo,
            is_active,
            placement_status,
            profile_completion,
            created_at,
            updated_at
        ) VALUES (
            new.id,
            v_full_name,
            new.email,
            v_department,
            COALESCE(new.raw_user_meta_data->>'roll_number', '23CS' || LPAD(FLOOR(RANDOM()*899+100)::TEXT, 3, '0')),
            v_avatar,
            TRUE,
            'not_placed',
            40,
            NOW(),
            NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
            email = EXCLUDED.email,
            updated_at = NOW();
    ELSIF v_role = 'alumni' THEN
        INSERT INTO public.alumni (
            user_id,
            full_name,
            email,
            department,
            company,
            designation,
            profile_photo,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            new.id,
            v_full_name,
            new.email,
            v_department,
            COALESCE(v_company, 'Industry Leader'),
            COALESCE(new.raw_user_meta_data->>'designation', 'Software Engineer'),
            v_avatar,
            TRUE,
            NOW(),
            NOW()
        )
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    RETURN new;
END;
$$;

-- Alias handle_new_user for backward compatibility
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    RETURN public.handle_new_auth_user();
END;
$$;

-- Bind trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 2. Status verification: Block deactivated accounts
CREATE OR REPLACE FUNCTION public.is_user_active()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND status = 'active'
    );
$$;

REVOKE ALL ON FUNCTION public.is_user_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_user_active() TO authenticated, service_role;

COMMIT;
