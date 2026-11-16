-- ==============================================================================
-- CareerNexus — Lock Down Resumes Bucket Privacy & Signed URL Access
-- Migration: 20261114_lock_down_resumes_bucket.sql
-- ==============================================================================

-- 1. Ensure resumes bucket is strictly private (public = false)
UPDATE storage.buckets
SET public = false,
    file_size_limit = 10485760, -- 10MB limit
    allowed_mime_types = ARRAY['application/pdf']::text[]
WHERE id = 'resumes';

-- 2. Drop legacy public read policy
DROP POLICY IF EXISTS "Public read resumes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read resumes" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users read resumes" ON storage.objects;

-- 3. Create private read policy requiring authentication and role/owner check
CREATE POLICY "Authorized users read resumes"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'resumes'
        AND (
            -- Student owns the resume
            owner = auth.uid()
            OR (storage.foldername(name))[1] = auth.uid()::text
            OR name LIKE (auth.uid()::text || '%')
            -- Or student matches roll number / student id in filename
            OR EXISTS (
                SELECT 1 FROM public.students
                WHERE public.students.user_id = auth.uid()
                AND (
                    storage.filename(objects.name) LIKE (public.students.roll_number || '%')
                    OR storage.filename(objects.name) LIKE (public.students.id::text || '%')
                )
            )
            -- Or user is an authorized Admin or Recruiter
            OR (SELECT users.role FROM public.users WHERE users.id = auth.uid()) IN ('admin', 'recruiter')
        )
    );

-- 4. Secure upload policy for authenticated students
DROP POLICY IF EXISTS "Authenticated upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "Students and authenticated upload resumes" ON storage.objects;

CREATE POLICY "Students and authenticated upload resumes"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'resumes'
        AND auth.uid() IS NOT NULL
    );

-- 5. Update and Delete policies for owner and admin
DROP POLICY IF EXISTS "Users update own resumes" ON storage.objects;
CREATE POLICY "Users update own resumes"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'resumes'
        AND (
            owner = auth.uid()
            OR name LIKE (auth.uid()::text || '%')
            OR (SELECT users.role FROM public.users WHERE users.id = auth.uid()) = 'admin'
        )
    );

DROP POLICY IF EXISTS "Users delete own resumes" ON storage.objects;
CREATE POLICY "Users delete own resumes"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'resumes'
        AND (
            owner = auth.uid()
            OR name LIKE (auth.uid()::text || '%')
            OR (SELECT users.role FROM public.users WHERE users.id = auth.uid()) = 'admin'
        )
    );
