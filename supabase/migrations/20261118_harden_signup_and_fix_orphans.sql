-- ============================================================================
-- CAREERNEXUS MIGRATION: HARDEN SIGNUP TRIGGER & RESOLVE "DATABASE ERROR SAVING NEW USER"
-- File: supabase/migrations/20261118_harden_signup_and_fix_orphans.sql
-- Description:
--   1. Fixes protect_user_role_and_status() to never block system/security-definer triggers.
--   2. Hardens handle_new_user() to:
--      - Safely handle pre-existing email/orphan records in public.users (avoiding duplicate key violations on users_email_key).
--      - Safely parse numeric/integer fields (cgpa, graduation_year, experience_years) to prevent cast crashes on empty/invalid strings.
--      - Automatically resolve student roll_number and alumni_id collisions in loops.
--      - Wrap role-specific profile inserts in exception blocks so non-critical profile defaults never abort auth signup.
--   3. Cleans up dead orphan records in public.users that have no corresponding auth.users row.
-- ============================================================================

BEGIN;

-- 1. Fix protect_user_role_and_status() to permit system triggers (postgres, supabase_admin, service_role)
CREATE OR REPLACE FUNCTION public.protect_user_role_and_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    -- Allow direct superuser / service / migration / system trigger execution
    IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.role::TEXT = 'admin' THEN
            IF (auth.uid() IS NULL OR public.get_user_role(auth.uid()) <> 'admin') THEN
                NEW.role := 'student';
            END IF;
        END IF;
        IF NEW.is_active IS NULL THEN
            NEW.is_active := TRUE;
        END IF;
        IF NEW.status IS NULL THEN
            NEW.status := 'active';
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF (NEW.role::TEXT IS DISTINCT FROM OLD.role::TEXT 
            OR NEW.is_active IS DISTINCT FROM OLD.is_active 
            OR NEW.status IS DISTINCT FROM OLD.status) THEN
            IF (auth.uid() IS NULL OR public.get_user_role(auth.uid()) <> 'admin') THEN
                RAISE EXCEPTION 'Unauthorized: Only administrators can modify roles, account activation, or status.';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

-- Ensure trigger is active on public.users
DROP TRIGGER IF EXISTS trg_protect_user_role_and_status ON public.users;
CREATE TRIGGER trg_protect_user_role_and_status
    BEFORE INSERT OR UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_user_role_and_status();

-- 2. Clean up dead orphan records in public.users that have no corresponding auth.users entry
-- and thus could block new registrations with duplicate key errors on users_email_key
DELETE FROM public.students 
WHERE user_id IN (
    SELECT u.id FROM public.users u 
    LEFT JOIN auth.users a ON a.id = u.id 
    WHERE a.id IS NULL
);

DELETE FROM public.alumni 
WHERE user_id IN (
    SELECT u.id FROM public.users u 
    LEFT JOIN auth.users a ON a.id = u.id 
    WHERE a.id IS NULL
);

DELETE FROM public.users 
WHERE id IN (
    SELECT u.id FROM public.users u 
    LEFT JOIN auth.users a ON a.id = u.id 
    WHERE a.id IS NULL
);

-- 3. Comprehensive, hardened handle_new_user() trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
    v_role user_role;
    v_raw_role TEXT;
    v_full_name TEXT;
    v_department TEXT;
    v_company TEXT;
    v_company_id UUID;
    v_company_id_raw TEXT;
    v_designation TEXT;
    v_phone TEXT;
    v_roll_number TEXT;
    v_base_username TEXT;
    v_username TEXT;
    v_counter INT;
    v_dept_code TEXT;
    v_alumni_id TEXT;
    v_avatar_url TEXT;
    v_existing_user_id UUID;
    
    -- Safe numeric/integer holders
    v_raw_cgpa TEXT;
    v_raw_grad_year TEXT;
    v_raw_exp_years TEXT;
    v_cgpa NUMERIC := 7.50;
    v_grad_year INT := 2027;
    v_exp_years NUMERIC := 2.5;
BEGIN
    -- 1. Extract Role safely (fallback to 'student' if invalid or unauthorized 'admin')
    v_raw_role := LOWER(TRIM(COALESCE(new.raw_user_meta_data->>'role', '')));
    IF v_raw_role = 'admin' THEN
        IF auth.uid() IS NOT NULL AND public.get_user_role(auth.uid()) = 'admin' THEN
            v_role := 'admin'::user_role;
        ELSE
            v_role := 'student'::user_role;
        END IF;
    ELSIF v_raw_role = 'alumni' THEN
        v_role := 'alumni'::user_role;
    ELSIF v_raw_role = 'recruiter' THEN
        v_role := 'recruiter'::user_role;
    ELSE
        v_role := 'student'::user_role;
    END IF;

    -- 2. Extract Full Name
    v_full_name := COALESCE(
        NULLIF(TRIM(new.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(new.raw_user_meta_data->>'name'), ''),
        split_part(new.email, '@', 1)
    );

    -- 3. Extract & Disambiguate Username
    v_base_username := COALESCE(
        NULLIF(TRIM(new.raw_user_meta_data->>'username'), ''),
        split_part(new.email, '@', 1)
    );
    v_base_username := REGEXP_REPLACE(v_base_username, '[^a-zA-Z0-9_]', '', 'g');
    IF v_base_username IS NULL OR v_base_username = '' THEN
        v_base_username := 'user_' || SUBSTRING(REPLACE(new.id::text, '-', '') FROM 1 FOR 6);
    END IF;

    v_username := v_base_username;
    v_counter := 1;
    WHILE EXISTS (SELECT 1 FROM public.users WHERE LOWER(username) = LOWER(v_username) AND id <> new.id) LOOP
        v_counter := v_counter + 1;
        v_username := v_base_username || v_counter::TEXT;
    END LOOP;

    -- 4. Extract Department (default to CSE for students/alumni)
    v_department := COALESCE(
        NULLIF(TRIM(new.raw_user_meta_data->>'department'), ''),
        'Computer Science & Engineering'
    );

    -- 5. Extract Company & Company ID
    v_company := COALESCE(
        NULLIF(TRIM(new.raw_user_meta_data->>'company'), ''),
        NULLIF(TRIM(new.raw_user_meta_data->>'company_name'), '')
    );
    
    v_company_id_raw := NULLIF(TRIM(new.raw_user_meta_data->>'company_id'), '');
    IF v_company_id_raw IS NOT NULL AND v_company_id_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT id INTO v_company_id FROM public.companies WHERE id = v_company_id_raw::uuid;
    END IF;

    IF v_company_id IS NULL AND v_company IS NOT NULL THEN
        SELECT id INTO v_company_id FROM public.companies WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_company)) LIMIT 1;
        IF v_company_id IS NULL THEN
            SELECT id INTO v_company_id FROM public.companies 
            WHERE LOWER(TRIM(name)) ILIKE '%' || LOWER(TRIM(v_company)) || '%'
               OR LOWER(TRIM(v_company)) ILIKE '%' || LOWER(TRIM(name)) || '%'
            ORDER BY LENGTH(name) ASC
            LIMIT 1;
        END IF;
    END IF;

    IF v_company IS NULL AND v_company_id IS NOT NULL THEN
        SELECT name INTO v_company FROM public.companies WHERE id = v_company_id;
    END IF;

    IF v_role = 'recruiter' AND v_company IS NULL THEN
        v_company := 'Independent Recruiting';
    END IF;

    -- 6. Extract Designation
    v_designation := NULLIF(TRIM(new.raw_user_meta_data->>'designation'), '');
    IF v_designation IS NULL THEN
        IF v_role = 'recruiter' THEN
            v_designation := 'Talent Acquisition';
        ELSIF v_role = 'alumni' THEN
            v_designation := 'Software Engineer';
        END IF;
    END IF;

    -- 7. Extract Phone
    v_phone := NULLIF(TRIM(new.raw_user_meta_data->>'phone'), '');

    -- 8. Extract Roll Number (Students only)
    v_roll_number := NULLIF(TRIM(new.raw_user_meta_data->>'roll_number'), '');
    IF v_role = 'student' THEN
        v_dept_code := CASE
            WHEN v_department ILIKE '%Computer%' OR v_department ILIKE '%CSE%' THEN 'CS'
            WHEN v_department ILIKE '%Information%' OR v_department ILIKE '%IT%' THEN 'IT'
            WHEN v_department ILIKE '%Electronics%' OR v_department ILIKE '%ECE%' THEN 'EC'
            WHEN v_department ILIKE '%Electrical%' OR v_department ILIKE '%EEE%' THEN 'EE'
            WHEN v_department ILIKE '%Mechanical%' OR v_department ILIKE '%MECH%' THEN 'ME'
            WHEN v_department ILIKE '%Civil%' THEN 'CE'
            ELSE 'CS'
        END;

        IF v_roll_number IS NULL OR EXISTS (SELECT 1 FROM public.students WHERE roll_number = v_roll_number AND user_id <> new.id) THEN
            LOOP
                v_roll_number := TO_CHAR(NOW(), 'YY') || v_dept_code || LPAD(FLOOR(RANDOM() * 89999 + 10000)::TEXT, 5, '0');
                EXIT WHEN NOT EXISTS (SELECT 1 FROM public.students WHERE roll_number = v_roll_number);
            END LOOP;
        END IF;
    END IF;

    -- 9. Extract Avatar URL
    v_avatar_url := NULLIF(TRIM(COALESCE(
        new.raw_user_meta_data->>'avatar_url',
        new.raw_user_meta_data->>'profile_photo',
        ''
    )), '');

    -- 10. Safe numeric parsing (never fail on empty string or non-numeric)
    v_raw_cgpa := NULLIF(TRIM(new.raw_user_meta_data->>'cgpa'), '');
    IF v_raw_cgpa IS NOT NULL AND v_raw_cgpa ~ '^[0-9]+(\.[0-9]+)?$' THEN
        BEGIN
            v_cgpa := v_raw_cgpa::numeric;
        EXCEPTION WHEN OTHERS THEN
            v_cgpa := 7.50;
        END;
    END IF;

    v_raw_grad_year := NULLIF(TRIM(new.raw_user_meta_data->>'graduation_year'), '');
    IF v_raw_grad_year IS NOT NULL AND v_raw_grad_year ~ '^[0-9]{4}$' THEN
        BEGIN
            v_grad_year := v_raw_grad_year::integer;
        EXCEPTION WHEN OTHERS THEN
            v_grad_year := CASE WHEN v_role = 'alumni' THEN 2023 ELSE 2027 END;
        END;
    ELSE
        v_grad_year := CASE WHEN v_role = 'alumni' THEN 2023 ELSE 2027 END;
    END IF;

    v_raw_exp_years := NULLIF(TRIM(new.raw_user_meta_data->>'experience_years'), '');
    IF v_raw_exp_years IS NOT NULL AND v_raw_exp_years ~ '^[0-9]+(\.[0-9]+)?$' THEN
        BEGIN
            v_exp_years := v_raw_exp_years::numeric;
        EXCEPTION WHEN OTHERS THEN
            v_exp_years := 2.5;
        END;
    END IF;

    -- 11. Handle pre-existing email conflicts in public.users
    SELECT id INTO v_existing_user_id
    FROM public.users
    WHERE LOWER(email) = LOWER(new.email) AND id <> new.id;

    IF v_existing_user_id IS NOT NULL THEN
        -- If this existing user row has no matching auth.users row, it is an orphan from a deleted auth user.
        -- Clean it up so the new signup claims the email cleanly without violating users_email_key.
        IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_existing_user_id) THEN
            DELETE FROM public.students WHERE user_id = v_existing_user_id;
            DELETE FROM public.alumni WHERE user_id = v_existing_user_id;
            DELETE FROM public.users WHERE id = v_existing_user_id;
        ELSE
            -- In the rare event an existing active auth user has this email under a different id,
            -- disambiguate the old row's email so this new auth signup can succeed cleanly.
            UPDATE public.users
            SET email = 'superseded_' || SUBSTRING(REPLACE(v_existing_user_id::text, '-', '') FROM 1 FOR 8) || '_' || email
            WHERE id = v_existing_user_id;
        END IF;
    END IF;

    -- 12. Upsert into public.users
    INSERT INTO public.users (
        id,
        email,
        full_name,
        username,
        role,
        avatar_url,
        is_active,
        status,
        activated_at,
        company,
        company_id,
        designation,
        department,
        phone,
        roll_number
    ) VALUES (
        new.id,
        new.email,
        v_full_name,
        v_username,
        v_role,
        v_avatar_url,
        TRUE,
        'active',
        NOW(),
        v_company,
        v_company_id,
        v_designation,
        v_department,
        v_phone,
        v_roll_number
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        username = COALESCE(EXCLUDED.username, public.users.username),
        role = EXCLUDED.role,
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
        company = COALESCE(EXCLUDED.company, public.users.company),
        company_id = COALESCE(EXCLUDED.company_id, public.users.company_id),
        designation = COALESCE(EXCLUDED.designation, public.users.designation),
        department = COALESCE(EXCLUDED.department, public.users.department),
        phone = COALESCE(EXCLUDED.phone, public.users.phone),
        roll_number = COALESCE(EXCLUDED.roll_number, public.users.roll_number),
        is_active = TRUE,
        status = 'active',
        activated_at = COALESCE(public.users.activated_at, NOW()),
        updated_at = NOW();

    -- 13. Role-specific profile table creation (robust with try/catch)
    IF v_role = 'student' THEN
        BEGIN
            INSERT INTO public.students (
                user_id,
                full_name,
                email,
                department,
                roll_number,
                profile_photo,
                avatar_url,
                phone,
                is_active,
                cgpa,
                graduation_year,
                placement_status,
                preferred_domain,
                profile_completion
            ) VALUES (
                new.id,
                v_full_name,
                new.email,
                v_department,
                v_roll_number,
                v_avatar_url,
                v_avatar_url,
                v_phone,
                TRUE,
                v_cgpa,
                v_grad_year,
                'Not Placed'::placement_status_type,
                'Software Development',
                60
            )
            ON CONFLICT (user_id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                email = EXCLUDED.email,
                department = EXCLUDED.department,
                roll_number = COALESCE(EXCLUDED.roll_number, public.students.roll_number),
                profile_photo = COALESCE(EXCLUDED.avatar_url, EXCLUDED.profile_photo, public.students.profile_photo),
                avatar_url = COALESCE(EXCLUDED.avatar_url, public.students.avatar_url, public.students.profile_photo),
                phone = COALESCE(EXCLUDED.phone, public.students.phone),
                updated_at = NOW();
        EXCEPTION 
            WHEN unique_violation THEN
                -- Roll number collided; pick another unique roll number and retry
                LOOP
                    v_roll_number := TO_CHAR(NOW(), 'YY') || 'CS' || LPAD(FLOOR(RANDOM() * 89999 + 10000)::TEXT, 5, '0');
                    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.students WHERE roll_number = v_roll_number);
                END LOOP;
                UPDATE public.users SET roll_number = v_roll_number WHERE id = new.id;

                BEGIN
                    INSERT INTO public.students (
                        user_id,
                        full_name,
                        email,
                        department,
                        roll_number,
                        profile_photo,
                        avatar_url,
                        phone,
                        is_active,
                        cgpa,
                        graduation_year,
                        placement_status,
                        preferred_domain,
                        profile_completion
                    ) VALUES (
                        new.id,
                        v_full_name,
                        new.email,
                        v_department,
                        v_roll_number,
                        v_avatar_url,
                        v_avatar_url,
                        v_phone,
                        TRUE,
                        v_cgpa,
                        v_grad_year,
                        'Not Placed'::placement_status_type,
                        'Software Development',
                        60
                    )
                    ON CONFLICT (user_id) DO UPDATE SET
                        full_name = EXCLUDED.full_name,
                        email = EXCLUDED.email,
                        department = EXCLUDED.department,
                        roll_number = EXCLUDED.roll_number,
                        avatar_url = COALESCE(EXCLUDED.avatar_url, public.students.avatar_url),
                        profile_photo = COALESCE(EXCLUDED.avatar_url, public.students.profile_photo),
                        updated_at = NOW();
                EXCEPTION WHEN OTHERS THEN
                    NULL;
                END;
            WHEN OTHERS THEN
                -- Non-fatal fallback: never crash auth signup due to secondary table issues
                BEGIN
                    INSERT INTO public.students (
                        user_id, full_name, email, department, roll_number, is_active, preferred_domain, placement_status
                    ) VALUES (
                        new.id, v_full_name, new.email, v_department, v_roll_number, TRUE, 'Software Development', 'Not Placed'::placement_status_type
                    )
                    ON CONFLICT (user_id) DO NOTHING;
                EXCEPTION WHEN OTHERS THEN
                    NULL;
                END;
        END;

    ELSIF v_role = 'alumni' THEN
        v_alumni_id := NULLIF(TRIM(new.raw_user_meta_data->>'alumni_id'), '');
        IF v_alumni_id IS NULL OR EXISTS (SELECT 1 FROM public.alumni WHERE alumni_id = v_alumni_id AND user_id <> new.id) THEN
            LOOP
                v_alumni_id := 'ALM' || TO_CHAR(NOW(), 'YY') || LPAD(FLOOR(RANDOM() * 8999 + 1000)::TEXT, 4, '0');
                EXIT WHEN NOT EXISTS (SELECT 1 FROM public.alumni WHERE alumni_id = v_alumni_id);
            END LOOP;
        END IF;

        BEGIN
            INSERT INTO public.alumni (
                user_id,
                alumni_id,
                full_name,
                email,
                department,
                company,
                company_id,
                designation,
                profile_photo,
                graduation_year,
                experience_years,
                is_active
            ) VALUES (
                new.id,
                v_alumni_id,
                v_full_name,
                new.email,
                v_department,
                COALESCE(v_company, 'Technology Partner'),
                v_company_id,
                COALESCE(v_designation, 'Software Engineer'),
                v_avatar_url,
                v_grad_year,
                v_exp_years,
                TRUE
            )
            ON CONFLICT (user_id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                email = EXCLUDED.email,
                department = EXCLUDED.department,
                company = EXCLUDED.company,
                company_id = COALESCE(EXCLUDED.company_id, public.alumni.company_id),
                designation = EXCLUDED.designation,
                profile_photo = COALESCE(EXCLUDED.profile_photo, public.alumni.profile_photo),
                updated_at = NOW();
        EXCEPTION WHEN OTHERS THEN
            -- Non-fatal fallback: ensure alumni profile row exists
            BEGIN
                INSERT INTO public.alumni (
                    user_id, alumni_id, full_name, email, department, company, designation, is_active
                ) VALUES (
                    new.id, v_alumni_id, v_full_name, new.email, v_department, COALESCE(v_company, 'Technology Partner'), COALESCE(v_designation, 'Software Engineer'), TRUE
                )
                ON CONFLICT (user_id) DO NOTHING;
            EXCEPTION WHEN OTHERS THEN
                NULL;
            END;
        END;
    END IF;

    RETURN new;
END;
$function$;

-- Alias for backward compatibility
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
BEGIN
    RETURN public.handle_new_user();
END;
$function$;

-- Ensure trigger is active on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

COMMIT;
