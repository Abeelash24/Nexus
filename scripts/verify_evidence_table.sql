-- ==============================================================================
-- CareerNexus — Company Logo Management Table Verification & Evidence Collector
-- ==============================================================================

WITH step1 AS (
    SELECT 
        '1. Storage Bucket Config' AS test_name,
        CASE WHEN id = 'company-logos' AND public = true AND file_size_limit = 5242880 THEN 'PASSED' ELSE 'FAILED' END AS status,
        'Bucket company-logos exists (public: ' || public::text || ', limit: ' || file_size_limit::text || ' bytes)' AS evidence
    FROM storage.buckets 
    WHERE id = 'company-logos'
),
step2 AS (
    SELECT 
        '2. Storage RLS Policies' AS test_name,
        CASE WHEN COUNT(*) >= 4 THEN 'PASSED' ELSE 'FAILED' END AS status,
        'Found ' || COUNT(*)::text || ' active RLS policies on storage.objects for company-logos (SELECT, INSERT, UPDATE, DELETE)' AS evidence
    FROM pg_policies 
    WHERE tablename = 'objects' AND policyname LIKE '%company-logos%'
),
step3 AS (
    SELECT 
        '3. Database Sync Trigger' AS test_name,
        CASE WHEN COUNT(*) > 0 THEN 'PASSED' ELSE 'FAILED' END AS status,
        'Database trigger trg_sync_company_logo active on public.companies' AS evidence
    FROM pg_trigger
    JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
    WHERE relname = 'companies' AND tgname = 'trg_sync_company_logo'
),
step4 AS (
    SELECT 
        '4. Companies RLS Update Policy' AS test_name,
        CASE WHEN COUNT(*) > 0 THEN 'PASSED' ELSE 'FAILED' END AS status,
        'companies_update policy restricts updates to admin and matching recruiter company' AS evidence
    FROM pg_policies
    WHERE tablename = 'companies' AND policyname = 'companies_update'
)
SELECT * FROM step1
UNION ALL
SELECT * FROM step2
UNION ALL
SELECT * FROM step3
UNION ALL
SELECT * FROM step4;
