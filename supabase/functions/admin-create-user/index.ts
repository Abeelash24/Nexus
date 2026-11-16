// CareerNexus — Admin User Provisioning Edge Function
// Deno TypeScript environment running on Supabase Edge Functions
// Safely provisions Supabase Auth users using server-side SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CreateUserPayload {
  email: string;
  password?: string;
  fullName: string;
  role: "student" | "alumni" | "recruiter" | "admin";
  phone?: string;
  department?: string;
  rollNumber?: string;
  company?: string;
  designation?: string;
  graduationYear?: number;
  cgpa?: number;
  skills?: string[];
  preferredDomain?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Edge function server configuration error: missing service credentials." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 0. Verify caller authentication & administrative privileges
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing Authorization header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: { user: callerUser }, error: callerError } = await supabaseAdmin.auth.getUser(token);
    if (callerError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or expired authentication token." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Query public.users to verify the caller's actual database role
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from("users")
      .select("role, is_active, status")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (
      profileError ||
      !callerProfile ||
      callerProfile.role !== "admin" ||
      callerProfile.is_active === false ||
      callerProfile.status === "deactivated"
    ) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Only active system administrators are authorized to provision user accounts." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: CreateUserPayload = await req.json();
    const {
      email,
      password,
      fullName,
      role,
      phone,
      department,
      rollNumber,
      company,
      designation,
      graduationYear,
      cgpa,
      skills,
      preferredDomain,
    } = body;

    if (!email || !fullName || !role) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, fullName, role." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Create user in Supabase Auth GoTrue with email confirmed
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: password || undefined,
      email_confirm: true,
      user_metadata: {
        role,
        full_name: fullName.trim(),
        roll_number: rollNumber || null,
        department: department || null,
        company: company || null,
        designation: designation || null,
      },
    });

    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ error: authError?.message || "Failed to create Supabase Auth user." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authUserId = authData.user.id;

    // 2. Insert into public.users (strictly matching verified columns)
    const { error: userError } = await supabaseAdmin.from("users").upsert({
      id: authUserId,
      email: email.trim().toLowerCase(),
      full_name: fullName.trim(),
      role: role,
      status: "active",
      is_active: true,
      phone: phone || null,
      company: company || null,
      designation: designation || null,
      department: department || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

    if (userError) {
      console.warn("Notice: public.users record insertion warning:", userError.message);
    }

    // 3. Create or update role-specific profile row
    if (role === "student") {
      const gradYear = graduationYear || 2027;
      await supabaseAdmin.from("students").upsert({
        user_id: authUserId,
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        roll_number: rollNumber?.trim().toUpperCase() || `26CS${Math.floor(Math.random() * 899 + 100)}`,
        department: department || "Computer Science & Engineering",
        course: "B.Tech",
        batch: `Batch ${gradYear - 4}-${gradYear}`,
        graduation_year: gradYear,
        phone: phone || null,
        cgpa: cgpa || 7.5,
        skills: skills && skills.length > 0 ? skills : ["Java", "SQL"],
        preferred_domain: preferredDomain || "Software Development",
        placement_status: "Not Placed",
        profile_completion: 70,
        is_active: true,
      }, { onConflict: "user_id" });
    } else if (role === "alumni") {
      const alumYear = graduationYear || 2024;
      await supabaseAdmin.from("alumni").upsert({
        user_id: authUserId,
        alumni_id: `ALUM-${alumYear}-${Math.floor(Math.random() * 899 + 100)}`,
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone || null,
        graduation_year: alumYear,
        department: department || "Computer Science & Engineering",
        company: company || "Corporate Partner",
        designation: designation || "Software Engineer",
        experience_years: 2.0,
        skills: skills && skills.length > 0 ? skills : ["System Design", "Cloud"],
        preferred_domains: [preferredDomain || "Software Engineering"],
        available_for_mentoring: true,
        is_active: true,
      }, { onConflict: "user_id" });
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId: authUserId,
        message: `Account for ${fullName} (${role}) successfully provisioned.`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || "Internal server error in user provisioning function." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
