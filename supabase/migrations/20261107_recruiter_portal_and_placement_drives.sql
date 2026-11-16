-- ==============================================================================
-- CareerNexus — Complete Recruiter Portal, Placement Drives & Storage Migration
-- Migration: 20261107_recruiter_portal_and_placement_drives.sql
-- ==============================================================================

-- 1. Ensure public.users has recruiter profile columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS company TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS designation TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS roll_number TEXT DEFAULT '';

-- 2. Create placement_drives table
CREATE TABLE IF NOT EXISTS public.placement_drives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    company_name TEXT NOT NULL,
    company_logo TEXT DEFAULT '',
    banner_url TEXT DEFAULT '',
    title TEXT NOT NULL,
    job_role TEXT NOT NULL DEFAULT '',
    role_designation TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    employment_type TEXT NOT NULL DEFAULT 'Full Time',
    location TEXT NOT NULL DEFAULT 'Bengaluru / Hybrid',
    eligibility_criteria TEXT DEFAULT '',
    eligible_departments TEXT[] NOT NULL DEFAULT ARRAY['Computer Science & Engineering', 'Information Technology']::TEXT[],
    eligible_batches TEXT[] NOT NULL DEFAULT ARRAY['2026', '2027']::TEXT[],
    minimum_cgpa NUMERIC(4,2) NOT NULL DEFAULT 6.50,
    max_backlogs INT NOT NULL DEFAULT 0,
    required_skills TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    application_start_date TIMESTAMPTZ DEFAULT NOW(),
    application_deadline TIMESTAMPTZ NOT NULL,
    drive_date TIMESTAMPTZ NOT NULL,
    salary_ctc TEXT NOT NULL DEFAULT '₹12 - ₹18 LPA',
    selection_process TEXT DEFAULT 'Online Assessment -> Technical Interview -> HR Interview',
    vacancies INT DEFAULT 5,
    status TEXT NOT NULL DEFAULT 'Published', -- 'Draft', 'Published', 'Closed'
    job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
    current_round_number INT NOT NULL DEFAULT 1,
    total_rounds INT NOT NULL DEFAULT 3,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_placement_drives_company ON public.placement_drives(company_name);
CREATE INDEX IF NOT EXISTS idx_placement_drives_status ON public.placement_drives(status);
CREATE INDEX IF NOT EXISTS idx_placement_drives_created_by ON public.placement_drives(created_by);
CREATE INDEX IF NOT EXISTS idx_placement_drives_date ON public.placement_drives(drive_date);

-- 3. Extend jobs table with banner_url, drive_id, created_by, eligible_departments, eligible_batches
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS banner_url TEXT DEFAULT '';
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS drive_id UUID REFERENCES public.placement_drives(id) ON DELETE CASCADE;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS eligible_departments TEXT[] DEFAULT ARRAY['Computer Science & Engineering', 'Information Technology']::TEXT[];
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS eligible_batches TEXT[] DEFAULT ARRAY['2026', '2027']::TEXT[];
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 4. Extend applications table with drive_id
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS drive_id UUID REFERENCES public.placement_drives(id) ON DELETE SET NULL;
ALTER TABLE public.applications ALTER COLUMN job_id DROP NOT NULL;

-- 5. Child tables for multi-round evaluations
CREATE TABLE IF NOT EXISTS public.drive_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drive_id UUID NOT NULL REFERENCES public.placement_drives(id) ON DELETE CASCADE,
    round_order INT NOT NULL DEFAULT 1,
    round_name TEXT NOT NULL,
    round_type TEXT NOT NULL DEFAULT 'Aptitude Test',
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 60,
    description TEXT DEFAULT '',
    venue_or_link TEXT DEFAULT 'Google Meet / Lab 3',
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_drive_round_order UNIQUE (drive_id, round_order)
);

CREATE TABLE IF NOT EXISTS public.interview_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drive_id UUID NOT NULL REFERENCES public.placement_drives(id) ON DELETE CASCADE,
    round_id UUID REFERENCES public.drive_rounds(id) ON DELETE SET NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    student_name TEXT DEFAULT '',
    student_roll TEXT DEFAULT '',
    interviewer_name TEXT NOT NULL DEFAULT 'Technical Panel 1',
    interviewer_email TEXT DEFAULT '',
    slot_date DATE NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    meeting_link TEXT DEFAULT '',
    venue TEXT DEFAULT 'Virtual / Google Meet',
    status TEXT NOT NULL DEFAULT 'Scheduled',
    feedback TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.drive_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drive_id UUID NOT NULL REFERENCES public.placement_drives(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    student_email TEXT NOT NULL DEFAULT '',
    company_name TEXT NOT NULL,
    role_designation TEXT NOT NULL,
    ctc_package TEXT NOT NULL,
    base_salary TEXT DEFAULT '',
    joining_date DATE,
    offer_letter_url TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Offered',
    acceptance_deadline TIMESTAMPTZ,
    student_response_at TIMESTAMPTZ,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_drive_student_offer UNIQUE (drive_id, student_id)
);

-- 6. Enable RLS on all tables
ALTER TABLE public.placement_drives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for placement_drives
DROP POLICY IF EXISTS "placement_drives_select" ON public.placement_drives;
CREATE POLICY "placement_drives_select" ON public.placement_drives
FOR SELECT TO authenticated
USING (
    status = 'Published' 
    OR status = 'Closed'
    OR created_by = auth.uid()
    OR (public.get_user_role(auth.uid()) = 'recruiter' AND company_name = (SELECT company FROM public.users WHERE id = auth.uid()))
    OR public.get_user_role(auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "placement_drives_insert" ON public.placement_drives;
CREATE POLICY "placement_drives_insert" ON public.placement_drives
FOR INSERT TO authenticated
WITH CHECK (
    public.get_user_role(auth.uid()) IN ('recruiter', 'admin')
);

DROP POLICY IF EXISTS "placement_drives_update" ON public.placement_drives;
CREATE POLICY "placement_drives_update" ON public.placement_drives
FOR UPDATE TO authenticated
USING (
    created_by = auth.uid()
    OR (public.get_user_role(auth.uid()) = 'recruiter' AND company_name = (SELECT company FROM public.users WHERE id = auth.uid()))
    OR public.get_user_role(auth.uid()) = 'admin'
)
WITH CHECK (
    created_by = auth.uid()
    OR (public.get_user_role(auth.uid()) = 'recruiter' AND company_name = (SELECT company FROM public.users WHERE id = auth.uid()))
    OR public.get_user_role(auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "placement_drives_delete" ON public.placement_drives;
CREATE POLICY "placement_drives_delete" ON public.placement_drives
FOR DELETE TO authenticated
USING (
    created_by = auth.uid()
    OR (public.get_user_role(auth.uid()) = 'recruiter' AND company_name = (SELECT company FROM public.users WHERE id = auth.uid()))
    OR public.get_user_role(auth.uid()) = 'admin'
);

-- 8. RLS Policies for jobs
DROP POLICY IF EXISTS "jobs_select" ON public.jobs;
DROP POLICY IF EXISTS "Anyone can view jobs" ON public.jobs;
CREATE POLICY "jobs_select" ON public.jobs
FOR SELECT TO authenticated
USING (
    status = 'Active'
    OR status = 'Closed'
    OR created_by = auth.uid()
    OR (public.get_user_role(auth.uid()) = 'recruiter' AND company_name = (SELECT company FROM public.users WHERE id = auth.uid()))
    OR public.get_user_role(auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "jobs_insert" ON public.jobs;
CREATE POLICY "jobs_insert" ON public.jobs
FOR INSERT TO authenticated
WITH CHECK (
    public.get_user_role(auth.uid()) IN ('recruiter', 'admin')
);

DROP POLICY IF EXISTS "jobs_update" ON public.jobs;
CREATE POLICY "jobs_update" ON public.jobs
FOR UPDATE TO authenticated
USING (
    created_by = auth.uid()
    OR (public.get_user_role(auth.uid()) = 'recruiter' AND company_name = (SELECT company FROM public.users WHERE id = auth.uid()))
    OR public.get_user_role(auth.uid()) = 'admin'
)
WITH CHECK (
    created_by = auth.uid()
    OR (public.get_user_role(auth.uid()) = 'recruiter' AND company_name = (SELECT company FROM public.users WHERE id = auth.uid()))
    OR public.get_user_role(auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "jobs_delete" ON public.jobs;
CREATE POLICY "jobs_delete" ON public.jobs
FOR DELETE TO authenticated
USING (
    created_by = auth.uid()
    OR (public.get_user_role(auth.uid()) = 'recruiter' AND company_name = (SELECT company FROM public.users WHERE id = auth.uid()))
    OR public.get_user_role(auth.uid()) = 'admin'
);

-- 9. RLS Policies for applications
DROP POLICY IF EXISTS "applications_select" ON public.applications;
CREATE POLICY "applications_select" ON public.applications
FOR SELECT TO authenticated
USING (
    student_id = auth.uid()
    OR student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
    OR (public.get_user_role(auth.uid()) = 'recruiter' AND company_name = (SELECT company FROM public.users WHERE id = auth.uid()))
    OR public.get_user_role(auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "applications_insert" ON public.applications;
CREATE POLICY "applications_insert" ON public.applications
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "applications_update" ON public.applications;
CREATE POLICY "applications_update" ON public.applications
FOR UPDATE TO authenticated
USING (
    public.get_user_role(auth.uid()) IN ('recruiter', 'admin')
    OR student_id = auth.uid()
    OR student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
)
WITH CHECK (
    public.get_user_role(auth.uid()) IN ('recruiter', 'admin')
    OR student_id = auth.uid()
    OR student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
);

-- 10. RLS Policies for companies
DROP POLICY IF EXISTS "companies_insert" ON public.companies;
CREATE POLICY "companies_insert" ON public.companies
FOR INSERT TO authenticated
WITH CHECK (
    public.get_user_role(auth.uid()) IN ('recruiter', 'admin')
);

DROP POLICY IF EXISTS "companies_update" ON public.companies;
CREATE POLICY "companies_update" ON public.companies
FOR UPDATE TO authenticated
USING (
    public.get_user_role(auth.uid()) IN ('recruiter', 'admin')
);

-- 11. Child tables RLS policies
DROP POLICY IF EXISTS "drive_rounds_select" ON public.drive_rounds;
CREATE POLICY "drive_rounds_select" ON public.drive_rounds FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "drive_rounds_write" ON public.drive_rounds;
CREATE POLICY "drive_rounds_write" ON public.drive_rounds FOR ALL TO authenticated
USING (public.get_user_role(auth.uid()) IN ('recruiter', 'admin'));

DROP POLICY IF EXISTS "interview_slots_select" ON public.interview_slots;
CREATE POLICY "interview_slots_select" ON public.interview_slots FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "interview_slots_write" ON public.interview_slots;
CREATE POLICY "interview_slots_write" ON public.interview_slots FOR ALL TO authenticated
USING (public.get_user_role(auth.uid()) IN ('recruiter', 'admin'));

DROP POLICY IF EXISTS "drive_offers_select" ON public.drive_offers;
CREATE POLICY "drive_offers_select" ON public.drive_offers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "drive_offers_write" ON public.drive_offers;
CREATE POLICY "drive_offers_write" ON public.drive_offers FOR ALL TO authenticated
USING (public.get_user_role(auth.uid()) IN ('recruiter', 'admin'));

-- 12. Create Storage Bucket for Drive Banners
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('drive-banners', 'drive-banners', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']::text[])
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[];

-- 13. Storage RLS policies for drive-banners
DROP POLICY IF EXISTS "Public read drive-banners" ON storage.objects;
CREATE POLICY "Public read drive-banners" ON storage.objects
    FOR SELECT USING (bucket_id = 'drive-banners');

DROP POLICY IF EXISTS "Recruiter and Admin upload drive-banners" ON storage.objects;
CREATE POLICY "Recruiter and Admin upload drive-banners" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'drive-banners' 
        AND public.get_user_role(auth.uid()) IN ('recruiter', 'admin')
    );

DROP POLICY IF EXISTS "Recruiter and Admin update drive-banners" ON storage.objects;
CREATE POLICY "Recruiter and Admin update drive-banners" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'drive-banners' 
        AND public.get_user_role(auth.uid()) IN ('recruiter', 'admin')
    );

DROP POLICY IF EXISTS "Recruiter and Admin delete drive-banners" ON storage.objects;
CREATE POLICY "Recruiter and Admin delete drive-banners" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'drive-banners' 
        AND public.get_user_role(auth.uid()) IN ('recruiter', 'admin')
    );
