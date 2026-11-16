-- ==============================================================================
-- CareerNexus — Live Trigger & Cascade Verification
-- ==============================================================================

DO $$
BEGIN
    -- Temporary table to hold test results
    CREATE TEMP TABLE IF NOT EXISTS test_cascade_results (
        step_id INT,
        scenario TEXT,
        status TEXT,
        evidence TEXT
    );
    DELETE FROM test_cascade_results;
END $$;

DO $$
DECLARE
    v_comp_id UUID;
    v_drive_id UUID;
    v_job_id UUID;
    v_recruiter_id UUID;
    v_initial_logo TEXT := 'https://plhehakcdqvibojagund.supabase.co/storage/v1/object/public/company-logos/logos/brand_v1.png';
    v_updated_logo TEXT := 'https://plhehakcdqvibojagund.supabase.co/storage/v1/object/public/company-logos/logos/brand_v2_new.png';
    v_banner_url TEXT := 'https://plhehakcdqvibojagund.supabase.co/storage/v1/object/public/drive-banners/banners/promotional_landscape.png';
    v_drive_logo_after TEXT;
    v_drive_banner_after TEXT;
    v_job_logo_after TEXT;
BEGIN
    SELECT id INTO v_recruiter_id FROM public.users WHERE role = 'recruiter' LIMIT 1;

    -- 1. Create Company
    INSERT INTO public.companies (name, logo, website, description, industry, location, tier)
    VALUES ('Titan CyberTech', v_initial_logo, 'https://titancyber.io', 'Enterprise Security', 'Cybersecurity', 'Bengaluru', 'Super Dream')
    RETURNING id INTO v_comp_id;

    -- 2. Create Placement Drive with separate banner and logo
    INSERT INTO public.placement_drives (
        company_name, company_logo, banner_url, title, job_role, role_designation,
        description, employment_type, location, eligibility_criteria,
        eligible_departments, eligible_batches, minimum_cgpa, max_backlogs,
        required_skills, application_start_date, application_deadline, drive_date,
        salary_ctc, selection_process, vacancies, status, created_by
    ) VALUES (
        'Titan CyberTech', v_initial_logo, v_banner_url, 'Titan Cyber Security Fellowship 2026',
        'Security Operations Analyst', 'Cyber Analyst', 'Threat modeling and incident response.',
        'Full Time', 'Bengaluru', 'CGPA >= 7.0', ARRAY['CSE', 'IT'], ARRAY['2026'],
        7.0, 0, ARRAY['Network Security', 'Linux', 'Python'], NOW(), NOW() + INTERVAL '10 days',
        NOW() + INTERVAL '15 days', '₹18 LPA', 'Technical Assessment -> Interview',
        5, 'Published', v_recruiter_id
    ) RETURNING id INTO v_drive_id;

    -- 3. Create Job
    INSERT INTO public.jobs (
        company_id, company_name, company_logo, banner_url, title, description,
        domain, location, employment_type, salary, eligibility, minimum_cgpa,
        required_skills, application_deadline, status, created_by
    ) VALUES (
        v_comp_id, 'Titan CyberTech', v_initial_logo, v_banner_url, 'Security Engineer',
        'Penetration testing and secure code review.', 'Cybersecurity', 'Bengaluru',
        'Full Time', '₹18 LPA', 'CGPA >= 7.0', 7.0, ARRAY['Python', 'Cryptography'],
        NOW() + INTERVAL '10 days', 'Active', v_recruiter_id
    ) RETURNING id INTO v_job_id;

    INSERT INTO test_cascade_results VALUES (
        1,
        'Distinct Banner & Logo Creation',
        'PASSED',
        'Drive created with separate banner (' || v_banner_url || ') and company logo (' || v_initial_logo || ')'
    );

    -- 4. Update Company Logo
    UPDATE public.companies
    SET logo = v_updated_logo, updated_at = NOW()
    WHERE id = v_comp_id;

    -- 5. Query cascaded values from placement_drives and jobs
    SELECT company_logo, banner_url INTO v_drive_logo_after, v_drive_banner_after
    FROM public.placement_drives WHERE id = v_drive_id;

    SELECT company_logo INTO v_job_logo_after
    FROM public.jobs WHERE id = v_job_id;

    IF v_drive_logo_after = v_updated_logo AND v_job_logo_after = v_updated_logo THEN
        INSERT INTO test_cascade_results VALUES (
            2,
            'Company Logo Update & Trigger Cascading',
            'PASSED',
            'Updating company logo automatically propagated to drives (logo: ' || v_drive_logo_after || ') and jobs (logo: ' || v_job_logo_after || ')'
        );
    ELSE
        INSERT INTO test_cascade_results VALUES (
            2,
            'Company Logo Update & Trigger Cascading',
            'FAILED',
            'Drive logo: ' || COALESCE(v_drive_logo_after, 'NULL') || ', Job logo: ' || COALESCE(v_job_logo_after, 'NULL')
        );
    END IF;

    IF v_drive_banner_after = v_banner_url THEN
        INSERT INTO test_cascade_results VALUES (
            3,
            'Banner Preservation & Isolation',
            'PASSED',
            'Drive banner was untouched and remained distinct (' || v_drive_banner_after || ')'
        );
    ELSE
        INSERT INTO test_cascade_results VALUES (
            3,
            'Banner Preservation & Isolation',
            'FAILED',
            'Banner was altered to: ' || COALESCE(v_drive_banner_after, 'NULL')
        );
    END IF;

    -- 6. Cleanup
    DELETE FROM public.jobs WHERE id = v_job_id;
    DELETE FROM public.placement_drives WHERE id = v_drive_id;
    DELETE FROM public.companies WHERE id = v_comp_id;
END $$;

SELECT * FROM test_cascade_results ORDER BY step_id ASC;
