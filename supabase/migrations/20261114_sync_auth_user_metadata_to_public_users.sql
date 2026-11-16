CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
    v_role user_role;
    v_full_name TEXT;
    v_department TEXT;
    v_company TEXT;
    v_designation TEXT;
    v_phone TEXT;
    v_roll_number TEXT;
BEGIN
    v_role := COALESCE(NULLIF(new.raw_user_meta_data->>'role', '')::user_role, 'student'::user_role);
    v_full_name := COALESCE(NULLIF(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1));
    v_department := COALESCE(NULLIF(new.raw_user_meta_data->>'department', ''), 'Computer Science & Engineering');
    v_company := NULLIF(new.raw_user_meta_data->>'company', '');
    v_designation := NULLIF(new.raw_user_meta_data->>'designation', '');
    v_phone := NULLIF(new.raw_user_meta_data->>'phone', '');
    v_roll_number := NULLIF(new.raw_user_meta_data->>'roll_number', '');

    -- Insert into public.users
    INSERT INTO public.users (id, email, full_name, role, avatar_url, is_active, status, activated_at, company, designation, department, phone, roll_number)
    VALUES (
        new.id,
        new.email,
        v_full_name,
        v_role,
        COALESCE(new.raw_user_meta_data->>'avatar_url', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'),
        TRUE,
        'active',
        NOW(),
        v_company,
        v_designation,
        v_department,
        v_phone,
        v_roll_number
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        company = COALESCE(EXCLUDED.company, public.users.company),
        designation = COALESCE(EXCLUDED.designation, public.users.designation),
        department = COALESCE(EXCLUDED.department, public.users.department),
        phone = COALESCE(EXCLUDED.phone, public.users.phone),
        roll_number = COALESCE(EXCLUDED.roll_number, public.users.roll_number),
        is_active = TRUE,
        status = 'active',
        activated_at = COALESCE(public.users.activated_at, NOW()),
        updated_at = NOW();

    -- Create profile matching role
    IF v_role = 'student' THEN
        INSERT INTO public.students (user_id, full_name, email, department, roll_number, profile_photo, is_active)
        VALUES (
            new.id,
            v_full_name,
            new.email,
            v_department,
            COALESCE(v_roll_number, '23' || SUBSTRING(v_department FROM 1 FOR 2) || LPAD(FLOOR(RANDOM()*899+100)::TEXT, 3, '0')),
            COALESCE(new.raw_user_meta_data->>'avatar_url', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'),
            TRUE
        )
        ON CONFLICT (user_id) DO NOTHING;
    ELSIF v_role = 'alumni' THEN
        INSERT INTO public.alumni (user_id, full_name, email, department, company, designation, profile_photo, is_active)
        VALUES (
            new.id,
            v_full_name,
            new.email,
            v_department,
            COALESCE(v_company, 'Technology Partner'),
            COALESCE(v_designation, 'Software Engineer'),
            COALESCE(new.raw_user_meta_data->>'avatar_url', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80'),
            TRUE
        )
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    RETURN new;
END;
$function$;

-- Update existing zoho recruiter record in public.users
UPDATE public.users
SET company = 'Zoho Corporation', designation = 'Lead Technical Recruiter'
WHERE email = 'zoho.recruiter@careernexus.com';
