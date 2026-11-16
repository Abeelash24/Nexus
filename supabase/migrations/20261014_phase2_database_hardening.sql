-- ============================================================================
-- CAREERNEXUS MIGRATION — PHASE 2: DATABASE HARDENING & INTEGRITY
-- File: supabase/migrations/20261014_phase2_database_hardening.sql
-- Description: Foreign-key integrity, check constraints, performance indexes,
--              duplicate application protection, and atomic application RPC.
-- ============================================================================

BEGIN;

-- 1. Check constraints for academic data and job compensation
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_students_cgpa') THEN
        ALTER TABLE public.students 
            ADD CONSTRAINT chk_students_cgpa CHECK (cgpa >= 0.0 AND cgpa <= 10.0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_jobs_salary') THEN
        ALTER TABLE public.jobs 
            ADD CONSTRAINT chk_jobs_salary CHECK (salary_min >= 0 AND salary_max >= salary_min);
    END IF;
END $$;

-- 2. Duplicate application prevention
CREATE UNIQUE INDEX IF NOT EXISTS uq_applications_student_job 
    ON public.applications (student_id, job_id);

-- 3. Performance indexes for job and application queries
CREATE INDEX IF NOT EXISTS idx_applications_job_status 
    ON public.applications (job_id, status);

CREATE INDEX IF NOT EXISTS idx_jobs_company_active 
    ON public.jobs (company_id, is_active);

CREATE INDEX IF NOT EXISTS idx_students_user_id 
    ON public.students (user_id);

-- 4. Atomic application submission RPC
CREATE OR REPLACE FUNCTION public.submit_job_application(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_student_id UUID;
    v_job_active BOOLEAN;
    v_application_id UUID;
BEGIN
    -- Verify caller is authenticated
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;

    -- Verify caller is a registered student
    SELECT id INTO v_student_id FROM public.students WHERE user_id = auth.uid();
    IF v_student_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only registered students can apply');
    END IF;

    -- Verify job exists and is open
    SELECT is_active INTO v_job_active FROM public.jobs WHERE id = p_job_id;
    IF NOT FOUND OR NOT v_job_active THEN
        RETURN jsonb_build_object('success', false, 'error', 'Job is no longer accepting applications');
    END IF;

    -- Insert application atomically
    INSERT INTO public.applications (job_id, student_id, status, applied_at, created_at, updated_at)
    VALUES (p_job_id, v_student_id, 'applied', NOW(), NOW(), NOW())
    RETURNING id INTO v_application_id;

    RETURN jsonb_build_object('success', true, 'application_id', v_application_id);
EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object('success', false, 'error', 'You have already applied for this job');
END;
$$;

REVOKE ALL ON FUNCTION public.submit_job_application(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_job_application(UUID) TO authenticated, service_role;

COMMIT;
