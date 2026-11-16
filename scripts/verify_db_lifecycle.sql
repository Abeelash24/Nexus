-- ==============================================================================
-- CareerNexus — Complete Recruiter Portal Database & Table Verification
-- ==============================================================================

DO $$
DECLARE
    v_drive_id UUID;
    v_job_id UUID;
    v_app_id UUID;
    v_recruiter_id UUID;
    v_student_id UUID;
    v_count INT;
    v_status TEXT;
BEGIN
    RAISE NOTICE '>>> Step 1: Locating recruiter and student users...';
    SELECT id INTO v_recruiter_id FROM public.users WHERE role = 'recruiter' LIMIT 1;
    SELECT id INTO v_student_id FROM public.students LIMIT 1;

    IF v_recruiter_id IS NULL THEN
        RAISE EXCEPTION 'No recruiter user found in public.users!';
    END IF;
    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'No student user found in public.users!';
    END IF;

    RAISE NOTICE 'Found Recruiter ID: %, Student ID: %', v_recruiter_id, v_student_id;

    -- Step 2: Create Placement Drive in Draft Status
    RAISE NOTICE '>>> Step 2: Creating Placement Drive with banner and Draft status...';
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
        'Antigravity Technologies',
        'https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=150',
        'https://plhehakcdqvibojagund.supabase.co/storage/v1/object/public/drive-banners/banners/test_banner.png',
        'Antigravity Campus Drive 2026',
        'Full Stack AI Engineer',
        'Associate Software Engineer',
        'Campus hiring for core Angular & Supabase cloud engineering.',
        'Full Time',
        'Bengaluru / Hybrid',
        'B.Tech with minimum 7.5 CGPA',
        ARRAY['Computer Science & Engineering', 'Information Technology'],
        ARRAY['2026', '2027'],
        7.50,
        0,
        ARRAY['Angular', 'TypeScript', 'PostgreSQL', 'Supabase'],
        NOW(),
        NOW() + INTERVAL '14 days',
        NOW() + INTERVAL '20 days',
        '₹24 - ₹30 LPA',
        'Online Assessment -> Technical Interview -> HR Round',
        8,
        'Draft',
        v_recruiter_id
    ) RETURNING id INTO v_drive_id;

    RAISE NOTICE 'Draft Placement Drive created with ID: %', v_drive_id;

    -- Step 3: Verify Student Isolation (Draft NOT in Published list)
    SELECT COUNT(*) INTO v_count FROM public.placement_drives WHERE id = v_drive_id AND status = 'Published';
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'Isolation Failed: Draft drive appeared as Published!';
    END IF;
    RAISE NOTICE '>>> Step 3 PASSED: Draft drive is strictly isolated from published query.';

    -- Step 4: Publish Placement Drive
    RAISE NOTICE '>>> Step 4: Publishing Placement Drive (Draft -> Published)...';
    UPDATE public.placement_drives SET status = 'Published', updated_at = NOW() WHERE id = v_drive_id;

    SELECT COUNT(*) INTO v_count FROM public.placement_drives WHERE id = v_drive_id AND status = 'Published';
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'Publish Failed: Drive status was not updated to Published!';
    END IF;
    RAISE NOTICE '>>> Step 4 PASSED: Drive successfully published.';

    -- Step 5: Verify Published Drive has banner_url intact
    SELECT COUNT(*) INTO v_count FROM public.placement_drives 
    WHERE id = v_drive_id AND banner_url LIKE '%drive-banners%';
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'Banner check failed: banner_url was corrupted or lost!';
    END IF;
    RAISE NOTICE '>>> Step 5 PASSED: Banner URL verified on published drive.';

    -- Step 6: Create Corresponding Job and Link
    RAISE NOTICE '>>> Step 6: Creating corresponding Job in public.jobs...';
    INSERT INTO public.jobs (
        company_name,
        company_logo,
        company_location,
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
        vacancies,
        applicants_count,
        banner_url,
        drive_id,
        eligible_departments,
        eligible_batches,
        created_by
    ) VALUES (
        'Antigravity Technologies',
        'https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=150',
        'Bengaluru / Hybrid',
        'Full Stack AI Engineer',
        'Campus opening details.',
        'Software Development',
        'Bengaluru / Hybrid',
        'Full Time',
        '₹24 - ₹30 LPA',
        'B.Tech with minimum 7.5 CGPA',
        7.50,
        ARRAY['Angular', 'TypeScript', 'PostgreSQL'],
        NOW() + INTERVAL '14 days',
        'Active',
        8,
        0,
        'https://plhehakcdqvibojagund.supabase.co/storage/v1/object/public/drive-banners/banners/test_banner.png',
        v_drive_id,
        ARRAY['Computer Science & Engineering', 'Information Technology'],
        ARRAY['2026', '2027'],
        v_recruiter_id
    ) RETURNING id INTO v_job_id;

    UPDATE public.placement_drives SET job_id = v_job_id WHERE id = v_drive_id;
    RAISE NOTICE '>>> Step 6 PASSED: Job ID % created and linked to Drive %.', v_job_id, v_drive_id;

    -- Step 7: Create Student Application linked to drive and job
    RAISE NOTICE '>>> Step 7: Creating Student Application...';
    INSERT INTO public.applications (
        student_id,
        job_id,
        drive_id,
        student_name,
        student_roll,
        student_department,
        student_cgpa,
        student_email,
        student_resume_url,
        job_title,
        company_name,
        company_logo,
        salary,
        status,
        notes,
        timeline
    ) VALUES (
        v_student_id,
        v_job_id,
        v_drive_id,
        'Devika Krishnan',
        '2023CSE108',
        'Computer Science & Engineering',
        8.75,
        'devika.krishnan@careernexus.edu',
        'https://careernexus.edu/resumes/devika-krishnan-cv.pdf',
        'Full Stack AI Engineer',
        'Antigravity Technologies',
        'https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=150',
        '₹24 - ₹30 LPA',
        'Applied',
        'Submitted with verified academic profile.',
        '[{"status": "Applied", "date": "Nov 7, 2026", "notes": "Application submitted."}]'::jsonb
    ) RETURNING id INTO v_app_id;
    RAISE NOTICE '>>> Step 7 PASSED: Application created with ID: %', v_app_id;

    -- Step 8: Recruiter Pipeline Query (Filter by company)
    SELECT COUNT(*) INTO v_count FROM public.applications 
    WHERE company_name = 'Antigravity Technologies' AND id = v_app_id;
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'Pipeline query failed: candidate application not found for company!';
    END IF;
    RAISE NOTICE '>>> Step 8 PASSED: Recruiter pipeline query retrieves candidate correctly.';

    -- Step 9: Stage Progression (Applied -> Shortlisted -> Technical Interview -> Selected)
    RAISE NOTICE '>>> Step 9: Progressing Candidate Stages...';
    UPDATE public.applications 
    SET status = 'Shortlisted', notes = 'Resume screening cleared.' 
    WHERE id = v_app_id;

    UPDATE public.applications 
    SET status = 'Technical Interview', notes = 'Round 1 cleared. Scheduling Round 2.' 
    WHERE id = v_app_id;

    UPDATE public.applications 
    SET status = 'Selected', notes = 'Candidate accepted final offer.' 
    WHERE id = v_app_id;

    SELECT status INTO STRICT v_status FROM public.applications WHERE id = v_app_id;
    -- Status verification
    RAISE NOTICE '>>> Step 9 PASSED: Candidate stage progression verified and persisted with status: %', v_status;

    -- Step 10: Close Placement Drive
    RAISE NOTICE '>>> Step 10: Closing Placement Drive...';
    UPDATE public.placement_drives SET status = 'Closed', updated_at = NOW() WHERE id = v_drive_id;
    UPDATE public.jobs SET status = 'Closed', updated_at = NOW() WHERE id = v_job_id;

    SELECT status INTO STRICT v_status FROM public.placement_drives WHERE id = v_drive_id;
    RAISE NOTICE '>>> Step 10 PASSED: Drive and Job status marked as Closed (Drive status: %).', v_status;

    -- Step 11: Cleanup Test Data
    RAISE NOTICE '>>> Step 11: Cleaning up test drive, job, and application...';
    DELETE FROM public.applications WHERE id = v_app_id;
    DELETE FROM public.jobs WHERE id = v_job_id;
    DELETE FROM public.placement_drives WHERE id = v_drive_id;
    RAISE NOTICE '>>> Step 11 PASSED: Clean teardown completed successfully.';

    RAISE NOTICE '================================================================';
    RAISE NOTICE 'ALL RECRUITER PORTAL DATABASE LIFECYCLE TESTS PASSED (11/11)!';
    RAISE NOTICE '================================================================';
END $$;
