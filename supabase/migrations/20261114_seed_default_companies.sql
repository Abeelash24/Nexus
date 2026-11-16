-- ==============================================================================
-- CareerNexus — Seed Persistent Default Real-World Companies & RLS Verification
-- Migration: 20261114_seed_default_companies.sql
-- Project: plhehakcdqvibojagund
-- ==============================================================================

-- 1. Ensure Admin DELETE policy exists for public.companies
DROP POLICY IF EXISTS "companies_delete" ON public.companies;
CREATE POLICY "companies_delete"
    ON public.companies FOR DELETE
    TO authenticated
    USING (public.get_user_role(auth.uid()) = 'admin');

-- 2. Idempotent Seed for Default Real-World Companies
-- Inserts only if company name does not already exist (case-insensitive check)
INSERT INTO public.companies (
    name,
    industry,
    location,
    website,
    description,
    tier,
    average_package,
    active_jobs_count,
    placed_students_count,
    logo
)
SELECT
    v.name,
    v.industry,
    v.location,
    v.website,
    v.description,
    v.tier,
    v.average_package,
    v.active_jobs_count,
    v.placed_students_count,
    v.logo
FROM (
    VALUES
    (
        'Tata Consultancy Services (TCS)',
        'IT Services & Consulting',
        'Mumbai / Chennai, India',
        'https://www.tcs.com/careers/india',
        'Global leader in IT services, digital and business solutions partnering with the world''s largest businesses in their transformation journeys.',
        'Dream (Tier 2)',
        '₹9 - ₹12 LPA',
        3,
        45,
        'https://ui-avatars.com/api/?name=TCS&background=1e3a8a&color=fff&bold=true'
    ),
    (
        'Zoho Corporation',
        'Enterprise SaaS & Cloud Software',
        'Chennai, India',
        'https://www.zoho.com/careers/',
        'Pioneering product company building a comprehensive suite of cloud business software, operating system for business, and developer platforms.',
        'Super Dream (Tier 1)',
        '₹12 - ₹18 LPA',
        4,
        28,
        'https://ui-avatars.com/api/?name=Zoho&background=dc2626&color=fff&bold=true'
    ),
    (
        'Infosys',
        'Digital Services & Consulting',
        'Bengaluru / Chennai, India',
        'https://www.infosys.com/careers/',
        'Global leader in next-generation digital services and consulting, enabling enterprises across 56 countries to navigate their digital transformation.',
        'Dream (Tier 2)',
        '₹9.5 - ₹13 LPA',
        2,
        38,
        'https://ui-avatars.com/api/?name=Infosys&background=0284c7&color=fff&bold=true'
    ),
    (
        'Freshworks',
        'Cloud Software / SaaS',
        'Chennai, India',
        'https://www.freshworks.com/company/careers/',
        'Innovative SaaS provider creating delightful, AI-powered customer service, IT service management, and CRM software for modern organizations.',
        'Super Dream (Tier 1)',
        '₹18 - ₹24 LPA',
        3,
        16,
        'https://ui-avatars.com/api/?name=Freshworks&background=f97316&color=fff&bold=true'
    ),
    (
        'Cognizant',
        'IT & Business Consulting',
        'Chennai / Bengaluru, India',
        'https://careers.cognizant.com/',
        'Engineering modern businesses to improve everyday lives through artificial intelligence, cloud architecture, and modern core modernization.',
        'Dream (Tier 2)',
        '₹8.5 - ₹12 LPA',
        3,
        42,
        'https://ui-avatars.com/api/?name=Cognizant&background=0369a1&color=fff&bold=true'
    ),
    (
        'Accenture',
        'IT Services & Strategy Consulting',
        'Bengaluru / Chennai, India',
        'https://www.accenture.com/in-en/careers',
        'Global professional services company with leading capabilities in digital, cloud, security, and enterprise technology solutions.',
        'Super Dream (Tier 1)',
        '₹11 - ₹16 LPA',
        4,
        35,
        'https://ui-avatars.com/api/?name=Accenture&background=7c3aed&color=fff&bold=true'
    ),
    (
        'Wipro',
        'Technology Services & Consulting',
        'Bengaluru / Chennai, India',
        'https://careers.wipro.com/',
        'Leading technology services and consulting company focused on building innovative solutions that address clients'' most complex digital transformation needs.',
        'Core / Standard',
        '₹7.5 - ₹10 LPA',
        2,
        30,
        'https://ui-avatars.com/api/?name=Wipro&background=059669&color=fff&bold=true'
    )
) AS v(name, industry, location, website, description, tier, average_package, active_jobs_count, placed_students_count, logo)
WHERE NOT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(v.name))
);
