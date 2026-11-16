-- ============================================================================
-- CAREERNEXUS MIGRATION — PHASE 5: RECRUITMENT PIPELINE
-- File: supabase/migrations/20261014_phase5_recruitment_pipeline.sql
-- Description: Recruiter company isolation, scoped job/applicant management,
--              and atomic placement offer issuance with FK integrity.
-- ============================================================================

BEGIN;

-- 1. Scoped recruiter job management policy
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jobs_recruiter_manage_own" ON public.jobs;
CREATE POLICY "jobs_recruiter_manage_own"
    ON public.jobs FOR ALL
    USING (
        company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
        OR public.get_auth_role() IN ('admin', 'tpo')
    );

-- 2. Scoped recruiter application status management
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applications_recruiter_update_status" ON public.applications;
CREATE POLICY "applications_recruiter_update_status"
    ON public.applications FOR UPDATE
    USING (
        job_id IN (
            SELECT j.id FROM public.jobs j
            JOIN public.companies c ON j.company_id = c.id
            WHERE c.user_id = auth.uid()
        )
        OR public.get_auth_role() IN ('admin', 'tpo')
    );

-- 3. Atomic offer issuance RPC (reconciled against placement_drives and drive_offers)
CREATE OR REPLACE FUNCTION public.issue_placement_offer(
    p_application_id UUID, 
    p_package TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_job_id UUID;
    v_company_id UUID;
    v_company_name TEXT;
    v_job_title TEXT;
    v_student_id UUID;
    v_student_name TEXT;
    v_student_email TEXT;
    v_drive_id UUID;
BEGIN
    -- Verify caller is authenticated
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;

    -- Fetch application, job, company and student details
    SELECT 
        a.job_id, 
        j.company_id, 
        c.name,
        j.title,
        a.student_id,
        s.full_name,
        s.email
    INTO 
        v_job_id, 
        v_company_id, 
        v_company_name,
        v_job_title,
        v_student_id, 
        v_student_name,
        v_student_email
    FROM public.applications a
    JOIN public.jobs j ON a.job_id = j.id
    JOIN public.companies c ON j.company_id = c.id
    JOIN public.students s ON a.student_id = s.id
    WHERE a.id = p_application_id
    FOR UPDATE OF a;

    IF NOT FOUND THEN 
        RETURN jsonb_build_object('success', false, 'error', 'Application not found'); 
    END IF;

    -- Verify caller is authorized for this company (or admin/tpo)
    IF NOT (
        EXISTS (SELECT 1 FROM public.companies WHERE id = v_company_id AND user_id = auth.uid())
        OR public.get_auth_role() IN ('admin', 'tpo')
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: You do not manage this company');
    END IF;

    -- Update application status
    UPDATE public.applications 
    SET status = 'offered', updated_at = NOW() 
    WHERE id = p_application_id;

    -- Update student placement status
    UPDATE public.students 
    SET placement_status = 'placed', updated_at = NOW() 
    WHERE id = v_student_id;

    -- Resolve correct placement drive associated with this job
    SELECT id INTO v_drive_id
    FROM public.placement_drives
    WHERE job_id = v_job_id
    LIMIT 1;

    -- Only record in drive_offers if an associated placement drive exists
    -- This guarantees drive_offers_drive_id_fkey is NEVER violated
    IF v_drive_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'drive_offers'
    ) THEN
        INSERT INTO public.drive_offers (
            drive_id,
            student_id,
            student_name,
            student_email,
            company_name,
            role_designation,
            ctc_package,
            status,
            created_at,
            updated_at
        )
        VALUES (
            v_drive_id,
            v_student_id,
            v_student_name,
            COALESCE(v_student_email, ''),
            v_company_name,
            v_job_title,
            p_package,
            'Offered',
            NOW(),
            NOW()
        )
        ON CONFLICT (drive_id, student_id) 
        DO UPDATE SET 
            ctc_package = EXCLUDED.ctc_package,
            status = 'Offered',
            updated_at = NOW();
    END IF;

    RETURN jsonb_build_object('success', true, 'application_id', p_application_id);
END;
$$;

REVOKE ALL ON FUNCTION public.issue_placement_offer(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_placement_offer(UUID, TEXT) TO authenticated, service_role;

COMMIT;
