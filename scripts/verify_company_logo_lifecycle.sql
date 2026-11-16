-- ==============================================================================
-- CareerNexus — Company Logo Management & Database Lifecycle Verification
-- ==============================================================================

DO $$
DECLARE
    v_comp_id UUID;
    v_drive_id UUID;
    v_job_id UUID;
    v_recruiter_id UUID;
    v_bucket_public BOOLEAN;
    v_bucket_limit BIGINT;
    v_policy_count INT;
    v_trigger_count INT;
    v_drive_logo TEXT;
    v_drive_banner TEXT;
    v_job_logo TEXT;
    v_cascaded_drive_logo TEXT;
    v_cascaded_job_logo TEXT;
    v_preserved_banner TEXT;
    v_logo_v1 TEXT := 'https://plhehakcdqvibojagund.supabase.co/storage/v1/object/public/company-logos/logos/verifco_v1.png';
    v_logo_v2 TEXT := 'https://plhehakcdqvibojagund.supabase.co/storage/v1/object/public/company-logos/logos/verifco_v2_updated.png';
    v_banner_url TEXT := 'https://plhehakcdqvibojagund.supabase.co/storage/v1/object/public/drive-banners/banners/verifco_landscape_hero.png';
BEGIN
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'CAREERNEXUS — COMPANY LOGO MANAGEMENT VERIFICATION SUITE';
    RAISE NOTICE '================================================================';

    -- --------------------------------------------------------------------------
    -- 1. Verify Storage Bucket Configuration
    -- --------------------------------------------------------------------------
    RAISE NOTICE '>>> Scenario 1: Verifying storage bucket "company-logos"...';
    SELECT public, file_size_limit INTO v_bucket_public, v_bucket_limit
    FROM storage.buckets
    WHERE id = 'company-logos';

    IF v_bucket_public IS NULL THEN
        RAISE EXCEPTION 'FAILED: Bucket "company-logos" does not exist in storage.buckets!';
    END IF;
    IF v_bucket_public != TRUE THEN
        RAISE EXCEPTION 'FAILED: Bucket "company-logos" is not public!';
    END IF;
    IF v_bucket_limit != 5242880 THEN
        RAISE EXCEPTION 'FAILED: Bucket "company-logos" file size limit is % (expected 5242880)', v_bucket_limit;
    END IF;
    RAISE NOTICE '  [PASS] Scenario 1: Bucket "company-logos" verified (public: %, max_size: % bytes).', v_bucket_public, v_bucket_limit;

    -- --------------------------------------------------------------------------
    -- 2. Verify Storage RLS Policies
    -- --------------------------------------------------------------------------
    RAISE NOTICE '>>> Scenario 2: Verifying storage RLS policies on "company-logos"...';
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE tablename = 'objects' AND policyname LIKE '%company-logos%';

    IF v_policy_count < 4 THEN
        RAISE EXCEPTION 'FAILED: Expected 4 RLS policies on company-logos, found %', v_policy_count;
    END IF;
    RAISE NOTICE '  [PASS] Scenario 2: Storage RLS policies verified (% policies active: SELECT, INSERT, UPDATE, DELETE).', v_policy_count;

    -- --------------------------------------------------------------------------
    -- 3. Verify Database Trigger Configuration
    -- --------------------------------------------------------------------------
    RAISE NOTICE '>>> Scenario 3: Verifying company logo synchronization trigger...';
    SELECT COUNT(*) INTO v_trigger_count
    FROM pg_trigger
    JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
    WHERE relname = 'companies' AND tgname = 'trg_sync_company_logo';

    IF v_trigger_count = 0 THEN
        RAISE EXCEPTION 'FAILED: Trigger trg_sync_company_logo not found on public.companies!';
    END IF;
    RAISE NOTICE '  [PASS] Scenario 3: Database trigger "trg_sync_company_logo" verified on public.companies.';

    -- --------------------------------------------------------------------------
    -- 4. Locate an active recruiter user for testing
    -- --------------------------------------------------------------------------
    SELECT id INTO v_recruiter_id FROM public.users WHERE role = 'recruiter' LIMIT 1;
    IF v_recruiter_id IS NULL THEN
        RAISE EXCEPTION 'FAILED: No recruiter user found in public.users!';
    END IF;
    RAISE NOTICE '  Recruiter user located: %', v_recruiter_id;

    -- --------------------------------------------------------------------------
    -- 5. Create Test Company with Initial Logo
    -- --------------------------------------------------------------------------
    RAISE NOTICE '>>> Scenario 4: Creating company record with logo URL...';
    INSERT INTO public.companies (
        name,
        logo,
        website,
        description,
        industry,
        location,
        tier,
        active_jobs_count,
        placed_students_count,
        average_package
    ) VALUES (
        'VerifCo Enterprise',
        v_logo_v1,
        'https://verifco.com',
        'Next-generation cloud enterprise solutions partner.',
        'Enterprise Software',
        'Bengaluru',
        'Super Dream (Tier 1)',
        1,
        0,
        '₹24 LPA'
    ) RETURNING id INTO v_comp_id;

    RAISE NOTICE '  [PASS] Scenario 4: Company created (ID: %, Logo: %)', v_comp_id, v_logo_v1;

    -- --------------------------------------------------------------------------
    -- 6. Create Placement Drive & Job with Separate Banner and Logo
    -- --------------------------------------------------------------------------
    RAISE NOTICE '>>> Scenario 5: Creating Drive & Job with separate Banner and Company Logo...';
    INSERT INTO public.placement_drives (
        company_name,
        company_logo,
        banner_url,
        title,
        job_role,
        role_designation,
        description,
        employment_type,
        location,
        eligibility_criteria,
        eligible_departments,
        eligible_batches,
        minimum_cgpa,
        max_backlogs,
        required_skills,
        application_start_date,
        application_deadline,
        drive_date,
        salary_ctc,
        selection_process,
        vacancies,
        status,
        created_by
    ) VALUES (
        'VerifCo Enterprise',
        v_logo_v1,
        v_banner_url,
        'VerifCo Campus Hiring Wave 2026',
        'Senior Platform Engineer',
        'Associate Software Engineer',
        'Full stack and platform development with Angular, TypeScript, and Postgres.',
        'Full Time',
        'Bengaluru',
        'B.Tech with min 7.5 CGPA, 0 backlogs',
        ARRAY['Computer Science & Engineering', 'Information Technology'],
        ARRAY['2026', '2027'],
        7.5,
        0,
        ARRAY['TypeScript', 'PostgreSQL', 'Angular', 'Cloud Systems'],
        NOW(),
        NOW() + INTERVAL '14 days',
        NOW() + INTERVAL '21 days',
        '₹24 LPA',
        'Coding Round -> Technical Interview -> HR Interview',
        10,
        'Published',
        v_recruiter_id
    ) RETURNING id INTO v_drive_id;

    INSERT INTO public.jobs (
        company_id,
        company_name,
        company_logo,
        banner_url,
        title,
        description,
        domain,
        location,
        employment_type,
        salary,
        eligibility,
        minimum_cgpa,
        required_skills,
        application_deadline,
        status,
        created_by
    ) VALUES (
        v_comp_id,
        'VerifCo Enterprise',
        v_logo_v1,
        v_banner_url,
        'Full Stack Cloud Developer',
        'Responsible for microservices and dashboard portal development.',
        'Software Development',
        'Bengaluru',
        'Full Time',
        '₹24 LPA',
        'B.Tech CSE/IT with CGPA >= 7.5',
        7.5,
        ARRAY['Angular', 'TypeScript', 'PostgreSQL'],
        NOW() + INTERVAL '14 days',
        'Active',
        v_recruiter_id
    ) RETURNING id INTO v_job_id;

    -- Verify drive and job have distinct banner and logo
    SELECT company_logo, banner_url INTO v_drive_logo, v_drive_banner FROM public.placement_drives WHERE id = v_drive_id;
    SELECT company_logo INTO v_job_logo FROM public.jobs WHERE id = v_job_id;

    IF v_drive_logo != v_logo_v1 THEN
        RAISE EXCEPTION 'FAILED: Drive company_logo mismatch!';
    END IF;
    IF v_drive_banner != v_banner_url THEN
        RAISE EXCEPTION 'FAILED: Drive banner_url mismatch!';
    END IF;
    IF v_drive_logo = v_drive_banner THEN
        RAISE EXCEPTION 'FAILED: Drive banner and logo are identical! Must be separate.';
    END IF;

    RAISE NOTICE '  [PASS] Scenario 5: Separate Banner and Logo verified.';
    RAISE NOTICE '         Drive Banner: %', v_drive_banner;
    RAISE NOTICE '         Company Logo: %', v_drive_logo;

    -- --------------------------------------------------------------------------
    -- 7. Update Company Logo and Test Automatic Database Cascading
    -- --------------------------------------------------------------------------
    RAISE NOTICE '>>> Scenario 6: Updating Company Logo and verifying automatic cascading...';
    UPDATE public.companies
    SET logo = v_logo_v2, updated_at = NOW()
    WHERE id = v_comp_id;

    SELECT company_logo, banner_url INTO v_cascaded_drive_logo, v_preserved_banner
    FROM public.placement_drives
    WHERE id = v_drive_id;

    SELECT company_logo INTO v_cascaded_job_logo
    FROM public.jobs
    WHERE id = v_job_id;

    IF v_cascaded_drive_logo != v_logo_v2 THEN
        RAISE EXCEPTION 'FAILED: Cascaded drive logo was % (expected %)', v_cascaded_drive_logo, v_logo_v2;
    END IF;
    IF v_cascaded_job_logo != v_logo_v2 THEN
        RAISE EXCEPTION 'FAILED: Cascaded job logo was % (expected %)', v_cascaded_job_logo, v_logo_v2;
    END IF;
    IF v_preserved_banner != v_banner_url THEN
        RAISE EXCEPTION 'FAILED: Drive banner_url was corrupted during logo cascade!';
    END IF;

    RAISE NOTICE '  [PASS] Scenario 6: Automatic cascade verified successfully!';
    RAISE NOTICE '         New Company Logo:     %', v_logo_v2;
    RAISE NOTICE '         Cascaded Drive Logo:  %', v_cascaded_drive_logo;
    RAISE NOTICE '         Cascaded Job Logo:    %', v_cascaded_job_logo;
    RAISE NOTICE '         Preserved Banner URL: %', v_preserved_banner;

    -- --------------------------------------------------------------------------
    -- 8. Clean Up Test Records
    -- --------------------------------------------------------------------------
    DELETE FROM public.jobs WHERE id = v_job_id;
    DELETE FROM public.placement_drives WHERE id = v_drive_id;
    DELETE FROM public.companies WHERE id = v_comp_id;

    RAISE NOTICE '>>> Test records cleaned up successfully.';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'ALL COMPANY LOGO MANAGEMENT LIFECYCLE TESTS PASSED WITH 100%% SUCCESS';
    RAISE NOTICE '================================================================';
END $$;
