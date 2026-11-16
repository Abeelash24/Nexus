-- ============================================================================
-- CAREERNEXUS MIGRATION — PHASE 6 RLS SECURITY AUDIT & MULTI-TENANT HARDENING
-- File: supabase/migrations/20261115_phase6_rls_security_audit_hardening.sql
-- Description:
--   1. Scopes recruiter access on students, applications, placement_drives, jobs,
--      and storage resumes strictly to candidate applications for their own company.
--   2. Enforces institutional admin oversight across all entities.
--   3. Establishes public.connections table and gates messages behind accepted mentorship.
--   4. Hardens drive_offers foreign key handling and access policies.
--   5. Eliminates recursive RLS cycles using SECURITY DEFINER boundary functions.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Helper Functions (SECURITY DEFINER to prevent recursive RLS evaluation)
-- ----------------------------------------------------------------------------

-- Role detection
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT role::text FROM public.users WHERE id = user_uuid LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_user_role(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT role::text FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_auth_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated, service_role;

-- Resolve student table id from auth/user UUID
CREATE OR REPLACE FUNCTION public.get_student_id_by_user(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT s.id FROM public.students s WHERE s.user_id = p_user_id LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_student_id_by_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_id_by_user(UUID) TO authenticated, service_role;

-- Check if user is recruiter for a company
CREATE OR REPLACE FUNCTION public.is_recruiter_for_company(
    p_user_id UUID,
    p_company_name TEXT,
    p_company_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = p_user_id
          AND u.role = 'recruiter'
          AND (
              u.company = p_company_name
              OR (p_company_id IS NOT NULL AND p_company_id IN (
                  SELECT c.id FROM public.companies c WHERE c.name ILIKE u.company
              ))
          )
    );
$$;

REVOKE ALL ON FUNCTION public.is_recruiter_for_company(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_recruiter_for_company(UUID, TEXT, UUID) TO authenticated, service_role;

-- Check if candidate has applied to recruiter's company
CREATE OR REPLACE FUNCTION public.has_candidate_applied_to_recruiter(
    p_student_id UUID,
    p_student_user_id UUID,
    p_recruiter_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.applications a
        JOIN public.users u ON u.id = p_recruiter_user_id
        WHERE u.role = 'recruiter'
          AND (a.student_id = p_student_id OR a.student_id = p_student_user_id)
          AND (
              a.company_name = u.company
              OR a.company_id IN (
                  SELECT c.id FROM public.companies c WHERE c.name ILIKE u.company
              )
          )
    );
$$;

REVOKE ALL ON FUNCTION public.has_candidate_applied_to_recruiter(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_candidate_applied_to_recruiter(UUID, UUID, UUID) TO authenticated, service_role;

-- Check mentorship connection
CREATE OR REPLACE FUNCTION public.has_mentorship_connection(
    p_user1 UUID,
    p_user2 UUID,
    p_status TEXT DEFAULT 'accepted'
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.connections conn
        WHERE (
            (conn.requester_id = p_user1 AND conn.receiver_id = p_user2)
            OR (conn.requester_id = p_user2 AND conn.receiver_id = p_user1)
        )
        AND (p_status IS NULL OR conn.status = p_status)
    );
$$;

REVOKE ALL ON FUNCTION public.has_mentorship_connection(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_mentorship_connection(UUID, UUID, TEXT) TO authenticated, service_role;

-- Check resume file access
CREATE OR REPLACE FUNCTION public.can_access_resume_file(
    p_user_id UUID,
    p_file_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, storage, pg_temp
AS $$
DECLARE
    v_role TEXT;
    v_user_company TEXT;
BEGIN
    SELECT role::text, company INTO v_role, v_user_company FROM public.users WHERE id = p_user_id;

    -- Admin has institutional access
    IF v_role = 'admin' THEN
        RETURN TRUE;
    END IF;

    -- Student owns this resume
    IF EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.user_id = p_user_id
          AND (
              storage.filename(p_file_name) ~~ (s.roll_number || '%')
              OR storage.filename(p_file_name) ~~ (s.id::text || '%')
              OR storage.filename(p_file_name) ~~ (s.user_id::text || '%')
              OR p_file_name ~~ (s.user_id::text || '%')
              OR p_file_name ~~ (s.id::text || '%')
          )
    ) THEN
        RETURN TRUE;
    END IF;

    -- Recruiter: only if candidate applied to recruiter's company
    IF v_role = 'recruiter' AND v_user_company IS NOT NULL AND v_user_company <> '' THEN
        RETURN EXISTS (
            SELECT 1 FROM public.applications a
            WHERE (
                a.company_name = v_user_company
                OR a.company_id IN (SELECT c.id FROM public.companies c WHERE c.name ILIKE v_user_company)
            )
            AND (
                a.student_resume_url = p_file_name
                OR a.student_resume_url ILIKE ('%' || storage.filename(p_file_name))
                OR storage.filename(p_file_name) ILIKE ('%' || a.student_resume_url)
                OR EXISTS (
                    SELECT 1 FROM public.students s
                    WHERE (s.id = a.student_id OR s.user_id = a.student_id)
                      AND (
                          storage.filename(p_file_name) ~~ (s.roll_number || '%')
                          OR storage.filename(p_file_name) ~~ (s.id::text || '%')
                          OR p_file_name ~~ (s.user_id::text || '%')
                          OR p_file_name ~~ (s.id::text || '%')
                      )
                )
            )
        );
    END IF;

    RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_resume_file(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_resume_file(UUID, TEXT) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. ESTABLISH: public.connections Table & Realtime
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    request_type TEXT NOT NULL DEFAULT 'mentorship',
    connection_type TEXT NOT NULL DEFAULT 'mentorship',
    mentorship_topic TEXT DEFAULT 'Career Guidance & Interview Prep',
    reason TEXT DEFAULT '',
    message TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    requester_name TEXT DEFAULT '',
    requester_avatar TEXT DEFAULT '',
    requester_department TEXT DEFAULT 'Computer Science & Engineering',
    requester_program TEXT DEFAULT 'B.Tech',
    requester_graduation_year INT DEFAULT 2027,
    requester_skills TEXT[] DEFAULT ARRAY['Java', 'Data Structures', 'System Design']::TEXT[],
    receiver_name TEXT DEFAULT '',
    receiver_avatar TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ DEFAULT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_connections_no_self CHECK (requester_id <> receiver_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_connections_pair 
    ON public.connections (LEAST(requester_id, receiver_id), GREATEST(requester_id, receiver_id));

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "connections_select_policy" ON public.connections;
CREATE POLICY "connections_select_policy" ON public.connections
FOR SELECT TO authenticated
USING (
    requester_id = auth.uid()
    OR receiver_id = auth.uid()
    OR public.get_user_role(auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "connections_insert_policy" ON public.connections;
CREATE POLICY "connections_insert_policy" ON public.connections
FOR INSERT TO authenticated
WITH CHECK (
    requester_id = auth.uid()
    OR public.get_user_role(auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "connections_update_policy" ON public.connections;
CREATE POLICY "connections_update_policy" ON public.connections
FOR UPDATE TO authenticated
USING (
    receiver_id = auth.uid()
    OR requester_id = auth.uid()
    OR public.get_user_role(auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "connections_delete_policy" ON public.connections;
CREATE POLICY "connections_delete_policy" ON public.connections
FOR DELETE TO authenticated
USING (
    requester_id = auth.uid()
    OR receiver_id = auth.uid()
    OR public.get_user_role(auth.uid()) = 'admin'
);

ALTER TABLE public.connections REPLICA IDENTITY FULL;

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.connections;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

-- ----------------------------------------------------------------------------
-- 3. TIGHTEN: public.students RLS (Non-recursive)
-- ----------------------------------------------------------------------------
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view student profiles" ON public.students;
DROP POLICY IF EXISTS "students_isolate_own_data" ON public.students;
DROP POLICY IF EXISTS "students_recruiter_scoped_access" ON public.students;
DROP POLICY IF EXISTS "students_select_scoped" ON public.students;

CREATE POLICY "students_select_scoped" ON public.students
FOR SELECT TO authenticated
USING (
    -- 1. Student views own profile
    user_id = auth.uid()
    -- 2. Institutional Admin has full oversight
    OR public.get_user_role(auth.uid()) = 'admin'
    -- 3. Recruiter ONLY views candidates who applied to their own company
    OR public.has_candidate_applied_to_recruiter(students.id, students.user_id, auth.uid())
    -- 4. Alumni can view students with whom they have a connection request/relationship
    OR (
        public.get_user_role(auth.uid()) = 'alumni'
        AND public.has_mentorship_connection(students.user_id, auth.uid(), NULL)
    )
);

DROP POLICY IF EXISTS "Students can insert own profile" ON public.students;
CREATE POLICY "Students can insert own profile" ON public.students
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR public.get_user_role(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Students can update own profile" ON public.students;
CREATE POLICY "Students can update own profile" ON public.students
FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (user_id = auth.uid() OR public.get_user_role(auth.uid()) = 'admin');

-- ----------------------------------------------------------------------------
-- 4. TIGHTEN: public.applications RLS (Non-recursive)
-- ----------------------------------------------------------------------------
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applications_select" ON public.applications;
CREATE POLICY "applications_select" ON public.applications
FOR SELECT TO authenticated
USING (
    -- 1. Student views own application
    student_id = auth.uid()
    OR student_id = public.get_student_id_by_user(auth.uid())
    -- 2. Admin oversight
    OR public.get_user_role(auth.uid()) = 'admin'
    -- 3. Recruiter ONLY views applications for their company
    OR public.is_recruiter_for_company(auth.uid(), company_name, company_id)
);

DROP POLICY IF EXISTS "applications_update" ON public.applications;
CREATE POLICY "applications_update" ON public.applications
FOR UPDATE TO authenticated
USING (
    -- 1. Admin
    public.get_user_role(auth.uid()) = 'admin'
    -- 2. Recruiter ONLY updates applications for their company
    OR public.is_recruiter_for_company(auth.uid(), company_name, company_id)
    -- 3. Student can update own application
    OR student_id = auth.uid()
    OR student_id = public.get_student_id_by_user(auth.uid())
)
WITH CHECK (
    public.get_user_role(auth.uid()) = 'admin'
    OR public.is_recruiter_for_company(auth.uid(), company_name, company_id)
    OR student_id = auth.uid()
    OR student_id = public.get_student_id_by_user(auth.uid())
);

DROP POLICY IF EXISTS "applications_insert" ON public.applications;
CREATE POLICY "applications_insert" ON public.applications
FOR INSERT TO authenticated
WITH CHECK (
    student_id = auth.uid()
    OR student_id = public.get_student_id_by_user(auth.uid())
    OR public.get_user_role(auth.uid()) = 'admin'
);

-- ----------------------------------------------------------------------------
-- 5. TIGHTEN: public.placement_drives RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.placement_drives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "placement_drives_insert" ON public.placement_drives;
CREATE POLICY "placement_drives_insert" ON public.placement_drives
FOR INSERT TO authenticated
WITH CHECK (
    public.get_user_role(auth.uid()) = 'admin'
    OR public.is_recruiter_for_company(auth.uid(), company_name, company_id)
);

DROP POLICY IF EXISTS "placement_drives_select" ON public.placement_drives;
CREATE POLICY "placement_drives_select" ON public.placement_drives
FOR SELECT TO authenticated
USING (
    status = 'Published'
    OR status = 'Applications Open'
    OR status = 'In Progress'
    OR status = 'Closed'
    OR created_by = auth.uid()
    OR public.get_user_role(auth.uid()) = 'admin'
    OR public.is_recruiter_for_company(auth.uid(), company_name, company_id)
);

DROP POLICY IF EXISTS "placement_drives_update" ON public.placement_drives;
CREATE POLICY "placement_drives_update" ON public.placement_drives
FOR UPDATE TO authenticated
USING (
    public.get_user_role(auth.uid()) = 'admin'
    OR (
        public.get_user_role(auth.uid()) = 'recruiter'
        AND (
            created_by = auth.uid()
            OR public.is_recruiter_for_company(auth.uid(), company_name, company_id)
        )
    )
)
WITH CHECK (
    public.get_user_role(auth.uid()) = 'admin'
    OR (
        public.get_user_role(auth.uid()) = 'recruiter'
        AND (
            created_by = auth.uid()
            OR public.is_recruiter_for_company(auth.uid(), company_name, company_id)
        )
    )
);

DROP POLICY IF EXISTS "placement_drives_delete" ON public.placement_drives;
CREATE POLICY "placement_drives_delete" ON public.placement_drives
FOR DELETE TO authenticated
USING (
    public.get_user_role(auth.uid()) = 'admin'
    OR (
        public.get_user_role(auth.uid()) = 'recruiter'
        AND (
            created_by = auth.uid()
            OR public.is_recruiter_for_company(auth.uid(), company_name, company_id)
        )
    )
);

-- ----------------------------------------------------------------------------
-- 6. TIGHTEN: public.jobs RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jobs_insert" ON public.jobs;
CREATE POLICY "jobs_insert" ON public.jobs
FOR INSERT TO authenticated
WITH CHECK (
    public.get_user_role(auth.uid()) = 'admin'
    OR public.is_recruiter_for_company(auth.uid(), company_name, company_id)
);

DROP POLICY IF EXISTS "jobs_select" ON public.jobs;
CREATE POLICY "jobs_select" ON public.jobs
FOR SELECT TO authenticated
USING (
    status = 'Active'
    OR status = 'Closed'
    OR created_by = auth.uid()
    OR public.get_user_role(auth.uid()) = 'admin'
    OR public.is_recruiter_for_company(auth.uid(), company_name, company_id)
);

DROP POLICY IF EXISTS "jobs_update" ON public.jobs;
CREATE POLICY "jobs_update" ON public.jobs
FOR UPDATE TO authenticated
USING (
    public.get_user_role(auth.uid()) = 'admin'
    OR (
        public.get_user_role(auth.uid()) = 'recruiter'
        AND (
            created_by = auth.uid()
            OR public.is_recruiter_for_company(auth.uid(), company_name, company_id)
        )
    )
)
WITH CHECK (
    public.get_user_role(auth.uid()) = 'admin'
    OR (
        public.get_user_role(auth.uid()) = 'recruiter'
        AND (
            created_by = auth.uid()
            OR public.is_recruiter_for_company(auth.uid(), company_name, company_id)
        )
    )
);

DROP POLICY IF EXISTS "jobs_delete" ON public.jobs;
CREATE POLICY "jobs_delete" ON public.jobs
FOR DELETE TO authenticated
USING (
    public.get_user_role(auth.uid()) = 'admin'
    OR (
        public.get_user_role(auth.uid()) = 'recruiter'
        AND (
            created_by = auth.uid()
            OR public.is_recruiter_for_company(auth.uid(), company_name, company_id)
        )
    )
);

-- ----------------------------------------------------------------------------
-- 7. TIGHTEN: storage.objects (resumes bucket)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authorized users read resumes" ON storage.objects;
CREATE POLICY "Authorized users read resumes" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'resumes'
    AND (
        owner = auth.uid()
        OR (storage.foldername(name))[1] = auth.uid()::text
        OR name ~~ (auth.uid()::text || '%')
        OR public.can_access_resume_file(auth.uid(), name)
    )
);

-- ----------------------------------------------------------------------------
-- 8. TIGHTEN: public.drive_offers RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.drive_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drive_offers_select" ON public.drive_offers;
CREATE POLICY "drive_offers_select" ON public.drive_offers
FOR SELECT TO authenticated
USING (
    public.get_user_role(auth.uid()) = 'admin'
    OR student_id = auth.uid()
    OR student_id = public.get_student_id_by_user(auth.uid())
    OR public.is_recruiter_for_company(auth.uid(), company_name, NULL)
    OR (
        public.get_user_role(auth.uid()) = 'recruiter'
        AND EXISTS (
            SELECT 1 FROM public.placement_drives pd
            WHERE pd.id = drive_offers.drive_id
              AND (
                  pd.created_by = auth.uid()
                  OR public.is_recruiter_for_company(auth.uid(), pd.company_name, pd.company_id)
              )
        )
    )
);

DROP POLICY IF EXISTS "drive_offers_write" ON public.drive_offers;
CREATE POLICY "drive_offers_write" ON public.drive_offers
FOR ALL TO authenticated
USING (
    public.get_user_role(auth.uid()) = 'admin'
    OR public.is_recruiter_for_company(auth.uid(), company_name, NULL)
    OR (
        public.get_user_role(auth.uid()) = 'recruiter'
        AND EXISTS (
            SELECT 1 FROM public.placement_drives pd
            WHERE pd.id = drive_offers.drive_id
              AND (
                  pd.created_by = auth.uid()
                  OR public.is_recruiter_for_company(auth.uid(), pd.company_name, pd.company_id)
              )
        )
    )
)
WITH CHECK (
    public.get_user_role(auth.uid()) = 'admin'
    OR public.is_recruiter_for_company(auth.uid(), company_name, NULL)
    OR (
        public.get_user_role(auth.uid()) = 'recruiter'
        AND EXISTS (
            SELECT 1 FROM public.placement_drives pd
            WHERE pd.id = drive_offers.drive_id
              AND (
                  pd.created_by = auth.uid()
                  OR public.is_recruiter_for_company(auth.uid(), pd.company_name, pd.company_id)
              )
        )
    )
);

-- ----------------------------------------------------------------------------
-- 9. TIGHTEN: public.messages (Mentorship-Gated Chat RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own messages" ON public.messages;
DROP POLICY IF EXISTS "messages_select_gated" ON public.messages;

CREATE POLICY "messages_select_gated" ON public.messages
FOR SELECT TO authenticated
USING (
    public.get_user_role(auth.uid()) = 'admin'
    OR (
        (auth.uid() = sender_id OR auth.uid() = receiver_id)
        AND (
            conversation_id NOT LIKE 'conv-mentorship-%'
            OR public.has_mentorship_connection(messages.sender_id, messages.receiver_id, 'accepted')
        )
    )
);

DROP POLICY IF EXISTS "Users send messages" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_gated" ON public.messages;

CREATE POLICY "messages_insert_gated" ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = sender_id
    AND (
        public.get_user_role(auth.uid()) = 'admin'
        OR (
            conversation_id NOT LIKE 'conv-mentorship-%'
            OR public.has_mentorship_connection(messages.sender_id, messages.receiver_id, 'accepted')
        )
    )
);

-- ----------------------------------------------------------------------------
-- 10. RPC: issue_placement_offer with Safe Drive ID Resolution
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.issue_placement_offer(
    p_application_id UUID,
    p_package TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_job_id UUID;
    v_drive_id UUID;
    v_student_id UUID;
    v_student_name TEXT;
    v_student_email TEXT;
    v_company_name TEXT;
    v_company_id UUID;
    v_job_title TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;

    -- Lock and verify application
    SELECT 
        a.job_id, a.drive_id, a.student_id, a.student_name, a.student_email,
        a.company_name, a.company_id, a.job_title
    INTO 
        v_job_id, v_drive_id, v_student_id, v_student_name, v_student_email,
        v_company_name, v_company_id, v_job_title
    FROM public.applications a
    WHERE a.id = p_application_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Application not found');
    END IF;

    -- Verify caller is authorized (recruiter from company or admin)
    IF NOT (
        public.get_user_role(auth.uid()) = 'admin'
        OR public.is_recruiter_for_company(auth.uid(), v_company_name, v_company_id)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: You do not manage this company');
    END IF;

    -- Update application status
    UPDATE public.applications
    SET status = 'Selected', notes = COALESCE(notes, '') || ' Offer extended: ' || p_package, updated_at = NOW()
    WHERE id = p_application_id;

    -- Update student placement status
    UPDATE public.students
    SET placement_status = 'Selected'::public.placement_status_type, updated_at = NOW()
    WHERE id = v_student_id;

    -- Resolve valid placement_drives.id if v_drive_id is null or if v_job_id was passed
    IF v_drive_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.placement_drives WHERE id = v_drive_id) THEN
        SELECT pd.id INTO v_drive_id
        FROM public.placement_drives pd
        WHERE pd.id = v_job_id OR pd.job_id = v_job_id
        LIMIT 1;
    END IF;

    -- Only insert into drive_offers if a valid placement_drives.id exists
    IF v_drive_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.placement_drives WHERE id = v_drive_id) THEN
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
        ) VALUES (
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

    RETURN jsonb_build_object(
        'success', true,
        'application_id', p_application_id,
        'student_id', v_student_id,
        'drive_id', v_drive_id,
        'status', 'Selected'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.issue_placement_offer(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_placement_offer(UUID, TEXT) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 11. RECORD MIGRATION IN schema_migrations
-- ----------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20261115140000', 'phase6_rls_security_audit_hardening', ARRAY['-- phase 6 rls security audit hardening'])
ON CONFLICT (version) DO NOTHING;

COMMIT;
