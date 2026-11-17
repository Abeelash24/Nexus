-- Migration: 20261117_hardened_signup_trigger.sql
-- Description: Hardens user registration trigger (handle_new_user / handle_new_auth_user)
-- Supports username, department, company_id resolution, and eliminates unique constraint roll_number collisions

-- 1. Ensure username column exists on public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username TEXT;

-- 2. Backfill existing usernames safely without collisions
DO $$
DECLARE
    r RECORD;
    v_cand TEXT;
    v_i INT;
BEGIN
    FOR r IN SELECT id, email FROM public.users WHERE username IS NULL OR username = '' ORDER BY created_at ASC LOOP
        v_cand := split_part(r.email, '@', 1);
        v_cand := REGEXP_REPLACE(v_cand, '[^a-zA-Z0-9_]', '', 'g');
        IF v_cand IS NULL OR v_cand = '' THEN
            v_cand := 'user_' || SUBSTRING(REPLACE(r.id::text, '-', '') FROM 1 FOR 6);
        END IF;
        
        v_i := 1;
        WHILE EXISTS (SELECT 1 FROM public.users WHERE LOWER(username) = LOWER(v_cand) AND id <> r.id) LOOP
            v_i := v_i + 1;
            v_cand := split_part(r.email, '@', 1) || v_i::TEXT;
        END LOOP;
        UPDATE public.users SET username = v_cand WHERE id = r.id;
    END LOOP;
END $$;

-- 3. Create index for fast username lookup
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users (LOWER(username));

-- 4. Harden role and status protection trigger to never block superuser / SECURITY DEFINER execution
CREATE OR REPLACE FUNCTION public.protect_user_role_and_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Allow direct superuser / service / migration / security definer trigger execution
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
$$;

-- 5. Create or replace the canonical handle_new_user() SECURITY DEFINER trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
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
BEGIN
    -- 1. Extract Role safely (fallback to 'student' if invalid or unauthorized 'admin')
    v_raw_role := LOWER(TRIM(COALESCE(new.raw_user_meta_data->>'role', '')));
    IF v_raw_role = 'admin' THEN
        -- Only allow admin role if created by an existing admin or service role
        IF auth.uid() IS NOT NULL AND public.get_user_role(auth.uid()) = 'admin' THEN
            v_role := 'admin'::user_role;
        ELSE
            -- Self-registration cannot claim admin
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
    -- Clean characters to alphanumeric and underscores
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
        -- Case-insensitive exact match
        SELECT id INTO v_company_id FROM public.companies WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_company)) LIMIT 1;
        -- Substring match fallback
        IF v_company_id IS NULL THEN
            SELECT id INTO v_company_id FROM public.companies 
            WHERE LOWER(TRIM(name)) ILIKE '%' || LOWER(TRIM(v_company)) || '%'
               OR LOWER(TRIM(v_company)) ILIKE '%' || LOWER(TRIM(name)) || '%'
            ORDER BY LENGTH(name) ASC
            LIMIT 1;
        END IF;
    END IF;

    -- If company_id was resolved but company text was empty, populate company text
    IF v_company IS NULL AND v_company_id IS NOT NULL THEN
        SELECT name INTO v_company FROM public.companies WHERE id = v_company_id;
    END IF;

    -- Fallback company for recruiter if empty
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

    -- 8. Extract Avatar URL
    v_avatar_url := COALESCE(
        NULLIF(TRIM(new.raw_user_meta_data->>'avatar_url'), ''),
        NULLIF(TRIM(new.raw_user_meta_data->>'picture'), ''),
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
    );

    -- 9. Extract or Generate Student Roll Number
    v_roll_number := NULLIF(TRIM(new.raw_user_meta_data->>'roll_number'), '');
    IF v_role = 'student' THEN
        IF v_roll_number IS NULL THEN
            v_dept_code := UPPER(SUBSTRING(REGEXP_REPLACE(v_department, '[^a-zA-Z]', '', 'g') FROM 1 FOR 2));
            IF v_dept_code IS NULL OR LENGTH(v_dept_code) < 2 THEN
                v_dept_code := 'CS';
            END IF;

            LOOP
                v_roll_number := TO_CHAR(NOW(), 'YY') || v_dept_code || LPAD(FLOOR(RANDOM() * 89999 + 10000)::TEXT, 5, '0');
                EXIT WHEN NOT EXISTS (SELECT 1 FROM public.students WHERE roll_number = v_roll_number);
            END LOOP;
        ELSE
            -- Disambiguate if existing roll number collision
            IF EXISTS (SELECT 1 FROM public.students WHERE roll_number = v_roll_number AND user_id <> new.id) THEN
                v_roll_number := v_roll_number || '_' || LPAD(FLOOR(RANDOM() * 899 + 100)::TEXT, 3, '0');
            END IF;
        END IF;
    END IF;

    -- 10. Upsert into public.users
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

    -- 11. Role-specific profile table creation
    IF v_role = 'student' THEN
        BEGIN
            INSERT INTO public.students (
                user_id,
                full_name,
                email,
                department,
                roll_number,
                profile_photo,
                is_active,
                cgpa,
                graduation_year,
                placement_status,
                profile_completion
            ) VALUES (
                new.id,
                v_full_name,
                new.email,
                v_department,
                v_roll_number,
                v_avatar_url,
                TRUE,
                COALESCE((new.raw_user_meta_data->>'cgpa')::numeric, 7.50),
                COALESCE((new.raw_user_meta_data->>'graduation_year')::integer, 2027),
                'Not Placed'::placement_status_type,
                60
            )
            ON CONFLICT (user_id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                email = EXCLUDED.email,
                department = EXCLUDED.department,
                profile_photo = COALESCE(EXCLUDED.profile_photo, public.students.profile_photo),
                updated_at = NOW();
        EXCEPTION WHEN unique_violation THEN
            -- If roll_number collided despite loop check, regenerate and retry
            v_roll_number := TO_CHAR(NOW(), 'YY') || 'CS' || LPAD(FLOOR(RANDOM() * 89999 + 10000)::TEXT, 5, '0');
            INSERT INTO public.students (
                user_id,
                full_name,
                email,
                department,
                roll_number,
                profile_photo,
                is_active
            ) VALUES (
                new.id,
                v_full_name,
                new.email,
                v_department,
                v_roll_number,
                v_avatar_url,
                TRUE
            )
            ON CONFLICT (user_id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                email = EXCLUDED.email,
                department = EXCLUDED.department,
                updated_at = NOW();
        END;

    ELSIF v_role = 'alumni' THEN
        -- Generate unique alumni_id if null
        v_alumni_id := NULLIF(TRIM(new.raw_user_meta_data->>'alumni_id'), '');
        IF v_alumni_id IS NULL THEN
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
                COALESCE((new.raw_user_meta_data->>'graduation_year')::integer, 2023),
                COALESCE((new.raw_user_meta_data->>'experience_years')::numeric, 2.5),
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
        EXCEPTION WHEN unique_violation THEN
            -- In case of alumni_id collision, insert without alumni_id (it is nullable)
            INSERT INTO public.alumni (
                user_id,
                full_name,
                email,
                department,
                company,
                company_id,
                designation,
                profile_photo,
                is_active
            ) VALUES (
                new.id,
                v_full_name,
                new.email,
                v_department,
                COALESCE(v_company, 'Technology Partner'),
                v_company_id,
                COALESCE(v_designation, 'Software Engineer'),
                v_avatar_url,
                TRUE
            )
            ON CONFLICT (user_id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                email = EXCLUDED.email,
                department = EXCLUDED.department,
                company = EXCLUDED.company,
                company_id = COALESCE(EXCLUDED.company_id, public.alumni.company_id),
                designation = EXCLUDED.designation,
                updated_at = NOW();
        END;
    END IF;

    RETURN new;
END;
$$;

-- 6. Keep handle_new_auth_user() aliased to handle_new_user() for backwards compatibility
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    RETURN public.handle_new_user();
END;
$$;

-- 7. Ensure trigger on auth.users executes handle_new_user()
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
