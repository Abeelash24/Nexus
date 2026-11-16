-- ============================================================================
-- CAREERNEXUS MIGRATION — PHASE 1: SECURITY HARDENING
-- File: supabase/migrations/20261014_phase1_security_hardening.sql
-- Description: Production security foundation, student data isolation,
--              IDOR prevention, security audit logging, and role helpers.
-- ============================================================================

BEGIN;

-- 1. Helper function for auth role extraction with fixed search_path
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT role::text FROM public.users WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_auth_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated, service_role;

-- 2. Security audit logging infrastructure
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.security_audit_logs;
CREATE POLICY "audit_logs_select_admin"
    ON public.security_audit_logs FOR SELECT
    USING (public.get_auth_role() = 'admin');

DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.security_audit_logs;
CREATE POLICY "audit_logs_insert_authenticated"
    ON public.security_audit_logs FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Student data isolation and IDOR protection
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students_isolate_own_data" ON public.students;
CREATE POLICY "students_isolate_own_data"
    ON public.students FOR SELECT
    USING (
        user_id = auth.uid() 
        OR public.get_auth_role() IN ('admin', 'tpo')
    );

DROP POLICY IF EXISTS "students_update_own_profile" ON public.students;
CREATE POLICY "students_update_own_profile"
    ON public.students FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (
        user_id = auth.uid()
        AND (placement_status IS NOT DISTINCT FROM (SELECT placement_status FROM public.students WHERE user_id = auth.uid()))
    );

-- 4. Application ownership protection
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applications_student_view_own" ON public.applications;
CREATE POLICY "applications_student_view_own"
    ON public.applications FOR SELECT
    USING (
        student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
        OR public.get_auth_role() IN ('admin', 'tpo')
    );

COMMIT;
