-- ============================================================================
-- CAREERNEXUS MIGRATION — PHASE 4: STUDENT PLACEMENT READINESS
-- File: supabase/migrations/20261014_phase4_student_readiness.sql
-- Description: Placement readiness calculation engine (Profile 25%, Skills 35%,
--              Tasks 25%, Active Drives 15%, Assessment bonus max 5%).
-- ============================================================================

BEGIN;

-- 1. Ensure readiness score and profile data columns exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'students' 
          AND column_name = 'readiness_score'
    ) THEN
        ALTER TABLE public.students ADD COLUMN readiness_score NUMERIC(5,2) DEFAULT 0.0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'students' 
          AND column_name = 'skills'
    ) THEN
        ALTER TABLE public.students ADD COLUMN skills TEXT[] DEFAULT '{}';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'students' 
          AND column_name = 'projects'
    ) THEN
        ALTER TABLE public.students ADD COLUMN projects JSONB DEFAULT '[]'::jsonb;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'students' 
          AND column_name = 'certifications'
    ) THEN
        ALTER TABLE public.students ADD COLUMN certifications JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 2. Placement Readiness calculation engine (5-Factor mathematical model)
CREATE OR REPLACE FUNCTION public.calculate_student_readiness(p_student_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_score NUMERIC := 0.0;
    v_skills_count INT := 0;
    v_has_resume BOOLEAN := FALSE;
    v_has_projects BOOLEAN := FALSE;
    v_has_certs BOOLEAN := FALSE;
    v_tasks_completed INT := 0;
    v_drives_participated INT := 0;
    v_assessment_bonus NUMERIC := 0.0;
BEGIN
    -- Query student profile details
    SELECT 
        COALESCE(cardinality(skills), 0),
        (resume_url IS NOT NULL AND resume_url <> ''),
        (projects IS NOT NULL AND jsonb_array_length(projects) > 0),
        (certifications IS NOT NULL AND jsonb_array_length(certifications) > 0)
    INTO v_skills_count, v_has_resume, v_has_projects, v_has_certs
    FROM public.students 
    WHERE id = p_student_id;

    IF NOT FOUND THEN
        RETURN 0.0;
    END IF;

    -- Factor 1: Profile Completeness (25%)
    IF v_has_resume THEN v_score := v_score + 15.0; END IF;
    IF v_has_projects THEN v_score := v_score + 5.0; END IF;
    IF v_has_certs THEN v_score := v_score + 5.0; END IF;

    -- Factor 2: Technical Skills (35%)
    IF v_skills_count >= 5 THEN 
        v_score := v_score + 35.0; 
    ELSE 
        v_score := v_score + (v_skills_count * 7.0); 
    END IF;

    -- Factor 3: Placement Tasks (25%)
    -- Check completed student tasks if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_tasks') THEN
        SELECT COUNT(*) INTO v_tasks_completed
        FROM public.student_tasks
        WHERE student_id = p_student_id AND status = 'completed';

        IF v_tasks_completed >= 5 THEN
            v_score := v_score + 25.0;
        ELSE
            v_score := v_score + (v_tasks_completed * 5.0);
        END IF;
    ELSE
        v_score := v_score + 20.0; -- Default baseline
    END IF;

    -- Factor 4: Active Placement Drives Participation (15%)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'drive_round_results') THEN
        SELECT COUNT(DISTINCT drive_id) INTO v_drives_participated
        FROM public.drive_round_results
        WHERE student_id = p_student_id;

        IF v_drives_participated >= 3 THEN
            v_score := v_score + 15.0;
        ELSE
            v_score := v_score + (v_drives_participated * 5.0);
        END IF;
    ELSE
        v_score := v_score + 10.0; -- Default baseline
    END IF;

    -- Factor 5: Assessment Bonus (max 5 points)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attempts') THEN
        SELECT COALESCE(MAX(score), 0.0) INTO v_assessment_bonus
        FROM public.attempts
        WHERE student_id = p_student_id;

        IF v_assessment_bonus >= 80.0 THEN
            v_score := v_score + 5.0;
        ELSIF v_assessment_bonus >= 50.0 THEN
            v_score := v_score + 3.0;
        END IF;
    END IF;

    -- Cap maximum score at 100.0
    IF v_score > 100.0 THEN 
        v_score := 100.0; 
    END IF;

    -- Persist score to student record
    UPDATE public.students 
    SET readiness_score = v_score, updated_at = NOW() 
    WHERE id = p_student_id;

    RETURN v_score;
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_student_readiness(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_student_readiness(UUID) TO authenticated, service_role;

COMMIT;
