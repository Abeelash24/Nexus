-- CareerNexus: Alumni Mentorship Privacy & Data Isolation View
-- Ensures alumni can ONLY access students who have an accepted mentorship connection

CREATE OR REPLACE VIEW public.mentorship_connections AS
SELECT 
    c.id,
    c.id AS connection_id,
    CASE 
        WHEN u_rec.role = 'alumni' THEN c.receiver_id 
        ELSE c.requester_id 
    END AS alumni_id,
    CASE 
        WHEN u_req.role = 'student' THEN c.requester_id 
        ELSE c.receiver_id 
    END AS student_id,
    c.status,
    c.request_type,
    c.connection_type,
    c.mentorship_topic,
    c.reason,
    c.message,
    COALESCE(s.full_name, c.requester_name, u_req.full_name, 'Student Mentee') AS requester_name,
    COALESCE(s.profile_photo, s.avatar_url, c.requester_avatar, u_req.avatar_url) AS requester_avatar,
    COALESCE(s.department, c.requester_department, u_req.department, 'Engineering') AS requester_department,
    COALESCE(s.course, c.requester_program, 'B.Tech') AS requester_program,
    COALESCE(s.graduation_year, c.requester_graduation_year, 2027) AS requester_graduation_year,
    COALESCE(s.skills, c.requester_skills, ARRAY['Engineering']::TEXT[]) AS requester_skills,
    c.receiver_name,
    c.receiver_avatar,
    c.created_at,
    c.accepted_at,
    c.updated_at,
    s.id AS student_table_id,
    s.roll_number AS student_roll_number,
    s.cgpa AS student_cgpa,
    s.bio AS student_bio,
    s.preferred_domain AS student_preferred_domain,
    s.github_url AS student_github_url,
    s.linkedin_url AS student_linkedin_url,
    s.portfolio_url AS student_portfolio_url,
    s.placement_status AS student_placement_status
FROM public.connections c
LEFT JOIN public.users u_req ON c.requester_id = u_req.id
LEFT JOIN public.users u_rec ON c.receiver_id = u_rec.id
LEFT JOIN public.students s ON s.user_id = (CASE WHEN u_req.role = 'student' THEN c.requester_id ELSE c.receiver_id END);

GRANT SELECT ON public.mentorship_connections TO authenticated, anon;
