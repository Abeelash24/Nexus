-- ==============================================================================
-- CareerNexus — Company Logo Management & Storage Migration
-- Migration: 20261107_company_logo_management.sql
-- ==============================================================================

-- 1. Create company-logos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'company-logos',
    'company-logos',
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[];

-- 2. Storage RLS Policies for company-logos
DROP POLICY IF EXISTS "Public read company-logos" ON storage.objects;
CREATE POLICY "Public read company-logos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'company-logos');

DROP POLICY IF EXISTS "Recruiter and Admin upload company-logos" ON storage.objects;
CREATE POLICY "Recruiter and Admin upload company-logos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'company-logos'
        AND (EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.id = auth.uid()
            AND public.users.role IN ('recruiter', 'admin')
        ))
    );

DROP POLICY IF EXISTS "Recruiter and Admin update company-logos" ON storage.objects;
CREATE POLICY "Recruiter and Admin update company-logos"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'company-logos'
        AND (EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.id = auth.uid()
            AND public.users.role IN ('recruiter', 'admin')
        ))
    );

DROP POLICY IF EXISTS "Recruiter and Admin delete company-logos" ON storage.objects;
CREATE POLICY "Recruiter and Admin delete company-logos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'company-logos'
        AND (EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.id = auth.uid()
            AND public.users.role IN ('recruiter', 'admin')
        ))
    );

-- 3. Automatic synchronization trigger: updating company logo updates drives & jobs
CREATE OR REPLACE FUNCTION sync_company_logo_to_drives_and_jobs()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.placement_drives
    SET company_logo = NEW.logo
    WHERE company_id = NEW.id OR company_name ILIKE NEW.name;

    UPDATE public.jobs
    SET company_logo = NEW.logo
    WHERE company_id = NEW.id OR company_name ILIKE NEW.name;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_company_logo ON public.companies;
CREATE TRIGGER trg_sync_company_logo
    AFTER UPDATE OF logo ON public.companies
    FOR EACH ROW
    WHEN (OLD.logo IS DISTINCT FROM NEW.logo)
    EXECUTE FUNCTION sync_company_logo_to_drives_and_jobs();

-- 4. Secure companies update policy: Recruiter can only update their own assigned company
DROP POLICY IF EXISTS "companies_update" ON public.companies;
CREATE POLICY "companies_update" ON public.companies
    FOR UPDATE
    TO authenticated
    USING (
        (EXISTS (
            SELECT 1 FROM public.users 
            WHERE public.users.id = auth.uid() 
            AND public.users.role = 'admin'
        ))
        OR (
            (EXISTS (
                SELECT 1 FROM public.users 
                WHERE public.users.id = auth.uid() 
                AND public.users.role = 'recruiter'
            ))
            AND (
                name ILIKE (SELECT company FROM public.users WHERE id = auth.uid())
                OR (SELECT company FROM public.users WHERE id = auth.uid()) IS NULL
                OR (SELECT company FROM public.users WHERE id = auth.uid()) = ''
            )
        )
    );
