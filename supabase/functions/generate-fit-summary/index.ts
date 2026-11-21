// CareerNexus — AI-Powered Candidate Fit Summary Edge Function
// Deno TypeScript environment running on Supabase Edge Functions
// Evaluates candidate skills against job requirements using Google Gemini API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface FitSummaryPayload {
  student_skills?: string[] | string;
  job_requirements?: string[] | string;
  job_title?: string;
  candidate_name?: string;
  student_cgpa?: number;
  minimum_cgpa?: number;
}

serve(async (req: Request) => {
  // 1. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Parse request JSON
    let body: FitSummaryPayload = {};
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body. Expected student_skills and job_requirements." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Normalize input arrays
    const rawSkills = body.student_skills;
    const rawRequirements = body.job_requirements;
    const jobTitle = (body.job_title || "Target Role").trim();
    const candidateName = (body.candidate_name || "Candidate").trim();
    const studentCgpa = body.student_cgpa;
    const minimumCgpa = body.minimum_cgpa;

    const studentSkills: string[] = Array.isArray(rawSkills)
      ? rawSkills.map(s => String(s).trim()).filter(Boolean)
      : typeof rawSkills === "string"
      ? rawSkills.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)
      : [];

    const jobRequirements: string[] = Array.isArray(rawRequirements)
      ? rawRequirements.map(r => String(r).trim()).filter(Boolean)
      : typeof rawRequirements === "string"
      ? rawRequirements.split(/[,;\n]+/).map(r => r.trim()).filter(Boolean)
      : [];

    // Compute basic skill overlap
    const studentSkillsLower = new Set(studentSkills.map(s => s.toLowerCase()));
    const matchedSkills = jobRequirements.filter(req => studentSkillsLower.has(req.toLowerCase()));
    const missingSkills = jobRequirements.filter(req => !studentSkillsLower.has(req.toLowerCase()));

    const totalReqs = Math.max(jobRequirements.length, 1);
    const matchPercentage = Math.min(100, Math.round((matchedSkills.length / totalReqs) * 100));
    const matchLevel = matchPercentage >= 75 ? "High Fit" : matchPercentage >= 45 ? "Moderate Fit" : "Needs Review";

    // 4. Check for Gemini API key
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");
    let summaryText = "";
    let source = "gemini";

    if (geminiApiKey) {
      try {
        const prompt = `You are an expert technical recruiter and talent evaluation specialist conducting candidate screening for a top-tier software and engineering campus placement drive.

Candidate Name: ${candidateName}
Target Role: ${jobTitle}
${studentCgpa !== undefined ? `Candidate Academic CGPA: ${studentCgpa} / 10.0` : ""}
${minimumCgpa !== undefined ? `Minimum Required CGPA: ${minimumCgpa} / 10.0` : ""}
Candidate Technical Skills: ${studentSkills.length > 0 ? studentSkills.join(", ") : "None specified"}
Job Role Requirements: ${jobRequirements.length > 0 ? jobRequirements.join(", ") : "General software engineering competencies"}
Pre-computed Skill Overlap:
- Matched Skills: ${matchedSkills.length > 0 ? matchedSkills.join(", ") : "None"}
- Missing Skills / Requirements: ${missingSkills.length > 0 ? missingSkills.join(", ") : "None"}

INSTRUCTIONS:
Generate a concise, authoritative evaluation of EXACTLY TWO (2) SENTENCES evaluating the candidate's fit for this role:
- Sentence 1: Highlight the candidate's strongest skill alignments and relevant technical proficiencies for the role.
- Sentence 2: Identify any potential skill gaps, missing prerequisites, or specific technical areas that should be probed in upcoming interview rounds.

Formatting Rules:
- Output MUST be exactly two sentences.
- Do NOT include greetings, intro phrases (e.g. "Here is the summary"), bullet points, or markdown formatting.
- Respond in valid JSON format:
{
  "summary": "First sentence highlighting strong matches. Second sentence identifying skill gaps and interview suggestions."
}`;

        // Attempt Gemini 2.5 Flash
        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
        const response = await fetch(geminiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 300,
              responseMimeType: "application/json"
            }
          })
        });

        if (response.ok) {
          const result = await response.json();
          const candidateText = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) {
            const cleanJson = candidateText.replace(/```json/g, "").replace(/```/g, "").trim();
            const parsed = JSON.parse(cleanJson);
            if (parsed.summary && typeof parsed.summary === "string") {
              summaryText = parsed.summary.trim();
            }
          }
        } else {
          console.warn("Gemini 2.5 Flash returned non-200. Status:", response.status, await response.text());
        }
      } catch (geminiErr) {
        console.warn("Gemini generation error, falling back to smart heuristic:", geminiErr);
      }
    }

    // 5. Fallback Heuristic Generator (Guarantees zero downtime and high quality even without active Gemini keys)
    if (!summaryText) {
      source = "heuristic_model";
      const matchedSnippet = matchedSkills.length > 0
        ? matchedSkills.slice(0, 3).join(", ")
        : studentSkills.slice(0, 3).join(", ") || "core technical fundamentals";

      const missingSnippet = missingSkills.length > 0
        ? missingSkills.slice(0, 3).join(", ")
        : "advanced domain architecture";

      if (matchPercentage >= 75) {
        summaryText = `${candidateName} demonstrates strong technical alignment in ${matchedSnippet}, positioning them as a high-potential day-one contributor for the ${jobTitle} role. While overall technical fit is robust, verifying hands-on depth in ${missingSnippet} during technical rounds is recommended.`;
      } else if (matchPercentage >= 40) {
        summaryText = `${candidateName} showcases foundational proficiency in ${matchedSnippet}, satisfying several core baseline requirements for the ${jobTitle} position. However, noticeable gaps in ${missingSnippet} indicate that targeted interview probing and potential ramp-up support will be essential.`;
      } else {
        summaryText = `${candidateName} possesses transferable baseline skills including ${matchedSnippet}, but exhibits significant gaps against key ${jobTitle} requirements such as ${missingSnippet}. Deeper technical screening is advised to assess the candidate's learning agility and domain depth before advancement.`;
      }
    }

    // 6. Return structured response
    return new Response(
      JSON.stringify({
        success: true,
        summary: summaryText,
        match_percentage: matchPercentage,
        match_level: matchLevel,
        matched_skills: matchedSkills,
        missing_skills: missingSkills,
        source: source,
        candidate_name: candidateName,
        job_title: jobTitle,
        evaluated_at: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (err: any) {
    console.error("Unhandled error in generate-fit-summary:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || "Internal server error generating candidate fit summary."
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
