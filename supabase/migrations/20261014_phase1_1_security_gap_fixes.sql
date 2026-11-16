-- ============================================================================
-- CAREERNEXUS MIGRATION — PHASE 1.1: SECURITY GAP FIXES
-- File: supabase/migrations/20261014_phase1_1_security_gap_fixes.sql
-- Description: Scopes recruiter resume access strictly through company job applications,
--              blocks role privilege escalation, and hardens audit log tamper prevention.
-- ============================================================================

BEGIN;

-- 1. Recruiter resume and student profile access strictly scoped by job application
-- Fix: Removed "OR public.get_auth_role() = 'recruiter'" to prevent cross-company access.
DROP POLICY IF EXISTS "students_recruiter_scoped_access" ON public.students;
CREATE POLICY "students_recruiter_scoped_access"
    ON public.students FOR SELECT
    USING (
        EXISTS (
            SELECT 1 
            FROM public.applications a
            JOIN public.jobs j ON a.job_id = j.id
            JOIN public.companies c ON j.company_id = c.id
            WHERE a.student_id = students.id
              AND c.user_id = auth.uid()
        )
        OR public.get_auth_role() IN ('admin', 'tpo')
    );

-- 2. Protect public.users from role escalation via client updates
DROP POLICY IF EXISTS "users_block_role_escalation" ON public.users;
CREATE POLICY "users_block_role_escalation"
    ON public.users FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid()
        AND role = (SELECT role FROM public.users WHERE id = auth.uid())
        AND status = (SELECT status FROM public.users WHERE id = auth.uid())
    );

-- 3. Prevent tampering with audit logs (Immutable audit logs)
DROP POLICY IF EXISTS "audit_logs_prevent_modification" ON public.security_audit_logs;
CREATE POLICY "audit_logs_prevent_modification"
    ON public.security_audit_logs FOR UPDATE
    USING (false);

DROP POLICY IF EXISTS "audit_logs_prevent_deletion" ON public.security_audit_logs;
CREATE POLICY "audit_logs_prevent_deletion"
    ON public.security_audit_logs FOR DELETE
    USING (false);

COMMIT;
