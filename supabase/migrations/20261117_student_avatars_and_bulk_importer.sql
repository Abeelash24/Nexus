-- ============================================================================
-- CAREERNEXUS MIGRATION — STUDENT AVATARS & ADMIN BULK IMPORTER RPC
-- File: supabase/migrations/20261117_student_avatars_and_bulk_importer.sql
-- Description:
--   1. Ensures avatar_url TEXT column exists on both public.users and public.students
--   2. Ensures public avatars storage bucket exists with proper RLS policies
--   3. Updates handle_new_user() trigger to save avatar_url from metadata
--   4. Creates admin_bulk_create_students() SECURITY DEFINER RPC function
-- ============================================================================

BEGIN;

-- 1. Ensure avatar_url column exists on public.users and public.students
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Backfill avatar_url from profile_photo
UPDATE public.students
SET avatar_url = profile_photo
WHERE avatar_url IS NULL AND profile_photo IS NOT NULL;

UPDATE public.users u
SET avatar_url = s.avatar_url
FROM public.students s
WHERE s.user_id = u.id AND u.avatar_url IS NULL AND s.avatar_url IS NOT NULL;

-- 2. Configure 'avatars' Storage Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,
    5242880, -- 5MB limit
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

-- Storage RLS Policies for 'avatars'
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete avatars" ON storage.objects;
DROP POLICY IF EXISTS "Admins and users upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Admins and users update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Admins and users delete avatars" ON storage.objects;

-- Public read access for avatars
CREATE POLICY "Public read avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Authenticated users (and admins) upload avatars
CREATE POLICY "Admins and users upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'avatars' AND auth.uid() IS NOT NULL
);

-- Users can update their own avatars, admins can update any
CREATE POLICY "Admins and users update avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'avatars' AND auth.uid() IS NOT NULL
);

-- Users can delete their own avatars, admins can delete any
CREATE POLICY "Admins and users delete avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'avatars' AND (
        owner = auth.uid() OR
        public.get_user_role(auth.uid()) = 'admin'
    )
);

-- 3. Update handle_new_user() Trigger to cleanly preserve and propagate avatar_url
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
    IF v_role = 'student' AND v_roll_number IS NULL THEN
        v_dept_code := CASE
            WHEN v_department ILIKE '%Computer%' OR v_department ILIKE '%CSE%' THEN 'CS'
            WHEN v_department ILIKE '%Information%' OR v_department ILIKE '%IT%' THEN 'IT'
            WHEN v_department ILIKE '%Electronics%' OR v_department ILIKE '%ECE%' THEN 'EC'
            WHEN v_department ILIKE '%Electrical%' OR v_department ILIKE '%EEE%' THEN 'EE'
            WHEN v_department ILIKE '%Mechanical%' OR v_department ILIKE '%MECH%' THEN 'ME'
            WHEN v_department ILIKE '%Civil%' THEN 'CE'
            ELSE 'CS'
        END;

        LOOP
            v_roll_number := TO_CHAR(NOW(), 'YY') || v_dept_code || LPAD(FLOOR(RANDOM() * 89999 + 10000)::TEXT, 5, '0');
            EXIT WHEN NOT EXISTS (SELECT 1 FROM public.students WHERE roll_number = v_roll_number);
        END LOOP;
    END IF;

    -- 9. Extract Avatar URL
    v_avatar_url := NULLIF(TRIM(COALESCE(
        new.raw_user_meta_data->>'avatar_url',
        new.raw_user_meta_data->>'profile_photo',
        ''
    )), '');

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
                avatar_url,
                phone,
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
                v_avatar_url,
                v_phone,
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
                roll_number = COALESCE(EXCLUDED.roll_number, public.students.roll_number),
                profile_photo = COALESCE(EXCLUDED.avatar_url, EXCLUDED.profile_photo, public.students.profile_photo),
                avatar_url = COALESCE(EXCLUDED.avatar_url, public.students.avatar_url, public.students.profile_photo),
                phone = COALESCE(EXCLUDED.phone, public.students.phone),
                updated_at = NOW();
        EXCEPTION WHEN unique_violation THEN
            v_roll_number := TO_CHAR(NOW(), 'YY') || 'CS' || LPAD(FLOOR(RANDOM() * 89999 + 10000)::TEXT, 5, '0');
            INSERT INTO public.students (
                user_id,
                full_name,
                email,
                department,
                roll_number,
                profile_photo,
                avatar_url,
                is_active
            ) VALUES (
                new.id,
                v_full_name,
                new.email,
                v_department,
                v_roll_number,
                v_avatar_url,
                v_avatar_url,
                TRUE
            )
            ON CONFLICT (user_id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                email = EXCLUDED.email,
                department = EXCLUDED.department,
                avatar_url = COALESCE(EXCLUDED.avatar_url, public.students.avatar_url),
                profile_photo = COALESCE(EXCLUDED.avatar_url, public.students.profile_photo),
                updated_at = NOW();
        END;

    ELSIF v_role = 'alumni' THEN
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
$function$;

-- 4. Create Backend Admin RPC Function for Student Bulk Creation
CREATE OR REPLACE FUNCTION public.admin_bulk_create_students(p_students JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_caller_role TEXT;
    v_results JSONB := '[]'::jsonb;
    v_item JSONB;
    v_full_name TEXT;
    v_email TEXT;
    v_roll_number TEXT;
    v_department TEXT;
    v_cgpa NUMERIC;
    v_phone TEXT;
    v_avatar_url TEXT;
    v_password TEXT;
    v_user_id UUID;
    v_encrypted_pwd TEXT;
    v_base_username TEXT;
    v_username TEXT;
    v_counter INT;
    v_is_existing BOOLEAN;
BEGIN
    -- Authorization check: must be admin or superuser
    IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'Unauthorized: Authentication required.';
        END IF;
        
        v_caller_role := public.get_user_role(auth.uid());
        IF v_caller_role <> 'admin' THEN
            RAISE EXCEPTION 'Forbidden: Only administrators can bulk import students.';
        END IF;
    END IF;

    -- Validate input is a JSON array
    IF jsonb_typeof(p_students) <> 'array' THEN
        RAISE EXCEPTION 'Invalid input: p_students must be a JSON array.';
    END IF;

    -- Loop through each student row
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_students)
    LOOP
        BEGIN
            v_full_name := NULLIF(TRIM(v_item->>'full_name'), '');
            v_email := LOWER(NULLIF(TRIM(v_item->>'email'), ''));
            v_roll_number := NULLIF(TRIM(v_item->>'roll_number'), '');
            v_department := COALESCE(NULLIF(TRIM(v_item->>'department'), ''), 'Computer Science & Engineering');
            v_phone := NULLIF(TRIM(v_item->>'phone'), '');
            v_avatar_url := NULLIF(TRIM(v_item->>'avatar_url'), '');
            v_password := COALESCE(NULLIF(TRIM(v_item->>'password'), ''), 'Student@2026');
            
            BEGIN
                v_cgpa := (v_item->>'cgpa')::numeric;
            EXCEPTION WHEN OTHERS THEN
                v_cgpa := 7.50;
            END;
            IF v_cgpa IS NULL OR v_cgpa < 0 OR v_cgpa > 10 THEN
                v_cgpa := 7.50;
            END IF;

            -- Validation
            IF v_email IS NULL THEN
                v_results := v_results || jsonb_build_object(
                    'email', COALESCE(v_item->>'email', 'unknown'),
                    'roll_number', v_roll_number,
                    'status', 'error',
                    'reason', 'Email address is required.'
                );
                CONTINUE;
            END IF;

            IF v_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
                v_results := v_results || jsonb_build_object(
                    'email', v_email,
                    'roll_number', v_roll_number,
                    'status', 'error',
                    'reason', 'Invalid email address format.'
                );
                CONTINUE;
            END IF;

            IF v_full_name IS NULL THEN
                v_full_name := split_part(v_email, '@', 1);
            END IF;

            IF v_roll_number IS NULL THEN
                v_roll_number := '26CS' || LPAD(FLOOR(RANDOM() * 89999 + 10000)::TEXT, 5, '0');
            END IF;

            -- Check if user exists in auth.users
            SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = v_email;
            v_is_existing := (v_user_id IS NOT NULL);

            IF v_is_existing THEN
                -- Update existing auth.users metadata and password
                v_encrypted_pwd := extensions.crypt(v_password, extensions.gen_salt('bf'));
                
                UPDATE auth.users
                SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
                        'full_name', v_full_name,
                        'roll_number', v_roll_number,
                        'department', v_department,
                        'avatar_url', COALESCE(v_avatar_url, raw_user_meta_data->>'avatar_url'),
                        'role', 'student'
                    ),
                    encrypted_password = v_encrypted_pwd,
                    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
                    updated_at = NOW()
                WHERE id = v_user_id;

                -- Ensure auth.identities has matching entry
                INSERT INTO auth.identities (
                    id, user_id, provider_id, identity_data, provider, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(),
                    v_user_id,
                    v_user_id::text,
                    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
                    'email',
                    NOW(),
                    NOW()
                )
                ON CONFLICT (provider, provider_id) DO UPDATE SET
                    identity_data = EXCLUDED.identity_data,
                    updated_at = NOW();

            ELSE
                -- Create brand new confirmed auth.users record
                v_user_id := gen_random_uuid();
                v_encrypted_pwd := extensions.crypt(v_password, extensions.gen_salt('bf'));

                -- Username creation
                v_base_username := LOWER(REGEXP_REPLACE(split_part(v_email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'));
                IF v_base_username IS NULL OR v_base_username = '' THEN
                    v_base_username := 'stu_' || LOWER(REGEXP_REPLACE(v_roll_number, '[^a-zA-Z0-9]', '', 'g'));
                END IF;
                v_username := v_base_username;
                v_counter := 1;
                WHILE EXISTS (SELECT 1 FROM public.users WHERE LOWER(username) = LOWER(v_username) AND id <> v_user_id) LOOP
                    v_counter := v_counter + 1;
                    v_username := v_base_username || v_counter::TEXT;
                END LOOP;

                INSERT INTO auth.users (
                    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                    raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at,
                    confirmation_token, email_change, email_change_token_new, recovery_token
                ) VALUES (
                    v_user_id,
                    '00000000-0000-0000-0000-000000000000',
                    'authenticated',
                    'authenticated',
                    v_email,
                    v_encrypted_pwd,
                    NOW(),
                    '{"provider":"email","providers":["email"],"role":"student"}'::jsonb,
                    jsonb_build_object(
                        'full_name', v_full_name,
                        'role', 'student',
                        'department', v_department,
                        'roll_number', v_roll_number,
                        'username', v_username,
                        'avatar_url', v_avatar_url,
                        'email_verified', true
                    ),
                    false,
                    NOW(),
                    NOW(),
                    '', '', '', ''
                );

                INSERT INTO auth.identities (
                    id, user_id, provider_id, identity_data, provider, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(),
                    v_user_id,
                    v_user_id::text,
                    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
                    'email',
                    NOW(),
                    NOW()
                );
            END IF;

            -- Explicitly upsert public.users
            INSERT INTO public.users (
                id,
                email,
                full_name,
                role,
                avatar_url,
                phone,
                department,
                roll_number,
                is_active,
                status,
                activated_at,
                updated_at
            ) VALUES (
                v_user_id,
                v_email,
                v_full_name,
                'student'::user_role,
                v_avatar_url,
                v_phone,
                v_department,
                v_roll_number,
                TRUE,
                'active',
                NOW(),
                NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
                phone = COALESCE(EXCLUDED.phone, public.users.phone),
                department = EXCLUDED.department,
                roll_number = EXCLUDED.roll_number,
                is_active = TRUE,
                status = 'active',
                updated_at = NOW();

            -- Explicitly upsert public.students
            INSERT INTO public.students (
                user_id,
                full_name,
                email,
                department,
                roll_number,
                cgpa,
                avatar_url,
                profile_photo,
                phone,
                graduation_year,
                placement_status,
                profile_completion,
                is_active,
                updated_at
            ) VALUES (
                v_user_id,
                v_full_name,
                v_email,
                v_department,
                v_roll_number,
                v_cgpa,
                v_avatar_url,
                v_avatar_url,
                v_phone,
                2027,
                'Not Placed'::placement_status_type,
                70,
                TRUE,
                NOW()
            )
            ON CONFLICT (user_id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                department = EXCLUDED.department,
                roll_number = EXCLUDED.roll_number,
                cgpa = EXCLUDED.cgpa,
                avatar_url = COALESCE(EXCLUDED.avatar_url, public.students.avatar_url),
                profile_photo = COALESCE(EXCLUDED.avatar_url, public.students.profile_photo),
                phone = COALESCE(EXCLUDED.phone, public.students.phone),
                is_active = TRUE,
                updated_at = NOW();

            v_results := v_results || jsonb_build_object(
                'email', v_email,
                'roll_number', v_roll_number,
                'full_name', v_full_name,
                'status', CASE WHEN v_is_existing THEN 'updated' ELSE 'created' END,
                'user_id', v_user_id
            );

        EXCEPTION WHEN OTHERS THEN
            v_results := v_results || jsonb_build_object(
                'email', v_email,
                'roll_number', v_roll_number,
                'status', 'error',
                'reason', SQLERRM
            );
        END;
    END LOOP;

    RETURN v_results;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_bulk_create_students(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_bulk_create_students(JSONB) TO service_role;

COMMIT;
