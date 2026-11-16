# CAREERNEXUS — FINAL MIGRATION SQL DEEP AUDIT
**Audit Date**: 2026-10-14  
**Project**: CareerNexus / Nexus (`c:\Users\abeelash\nexus`)  
**Scope**: Deep line-by-line inspection of all 9 reconstructed Phase migrations against actual repository schema.  
**Execution State**: Read-only static audit. No SQL executed against Supabase.

---

## 1. Executive Summary & Verdict

### OVERALL RESULT: **SAFE WITH FIXES REQUIRED**

The 9 migration files represent a robust architectural and security foundation for CareerNexus. However, cross-referencing against the **real historical schema** (`20261002_*`, `20261007_*`, `20261008_*`, and `20261009_*`) revealed **3 Critical Defects** and **4 Important Warnings** that must be resolved before executing these migrations in a production database:

1. **CRITICAL (Foreign Key Failure)** in `20261014_phase5_recruitment_pipeline.sql`: `issue_placement_offer()` attempts to insert `v_job_id` (from `jobs.id`) into `public.drive_offers.drive_id`. In `20261007_placement_drives_management.sql`, `drive_offers.drive_id` has a foreign key constraint referencing `placement_drives(id)`, NOT `jobs(id)`. This will trigger a foreign key violation `drive_offers_drive_id_fkey` on every offer issuance.
2. **CRITICAL (Security Bypass)** in `20261014_phase1_1_security_gap_fixes.sql`: In policy `students_recruiter_scoped_access`, the clause `AND (c.user_id = auth.uid() OR public.get_auth_role() = 'recruiter')` contains `OR public.get_auth_role() = 'recruiter'`. This inadvertently allows **any** recruiter to read **any** student application across the entire platform, negating company-scoping.
3. **CRITICAL (Type Mismatch & Missing NOT-NULL Column)** in `20261014_phase6_alumni_mentorship_realtime.sql` & `phase6_1`: The historical `public.messages` table (`20261008_realtime_cross_device_chat.sql`) defined `conversation_id` as `TEXT NOT NULL` and `receiver_id` as `UUID NOT NULL`. The new policy `messages_select_gated` calls `is_conversation_member(conversation_id, auth.uid())` which expects `UUID`, causing a PostgreSQL function resolution error (`function is_conversation_member(text, uuid) does not exist`).
4. **IMPORTANT (Provisioning Trigger Conflict)** in `20261014_phase3_auth_rbac_hardening.sql`: Replacing `on_auth_user_created` with `public.handle_new_user()` overwrites the existing `handle_new_auth_user()` from `20261008_auth_fix_rls_and_provisioning.sql`, which is responsible for automatically creating the corresponding `public.students` or `public.alumni` child records.

---

## 2. Per-Migration Detailed Audit

### Migration 1: `20261014_phase1_security_hardening.sql`
- **Classification**: **VALID WITH WARNINGS**
- **Analysis**:
  - `get_auth_role()` helper: Well-formed, `SECURITY DEFINER`, fixed `SET search_path = public, auth`.
  - `security_audit_logs`: Proper table structure, RLS enabled, admin-only read policy.
  - `students_isolate_own_data`: Correctly allows students to view their own profile and Admins/TPOs to view all.
  - `students_update_own_profile`: Contains an RLS subquery in `WITH CHECK` comparing `placement_status` against `(SELECT placement_status FROM public.students WHERE user_id = auth.uid())`. While functionally valid, subquerying the updated table inside RLS can trigger recursion under complex transactions.
  - `applications_student_view_own`: Correctly scopes application reads.

---

### Migration 2: `20261014_phase1_1_security_gap_fixes.sql`
- **Classification**: **INVALID (FIX REQUIRED)**
- **Analysis**:
  - Line 21 in `students_recruiter_scoped_access`: Contains an `OR public.get_auth_role() = 'recruiter'` logic escape. Because every recruiter evaluates to true on this check, any recruiter can view every student who applied to any job in any company.
  - Line 32 in `users_block_role_escalation`: Uses subqueries inside `WITH CHECK` to prevent role escalation. In PostgreSQL, a `BEFORE UPDATE` trigger is the recommended standard to guarantee column immutability without RLS recursion.
  - Lines 37-45: `audit_logs_prevent_modification` and `audit_logs_prevent_deletion` correctly enforce audit log immutability via `USING (false)`.

---

### Migration 3: `20261014_phase2_database_hardening.sql`
- **Classification**: **VALID WITH WARNINGS**
- **Analysis**:
  - Check constraints `chk_students_cgpa` and `chk_jobs_salary`: Safely wrapped in `DO $$ ... IF NOT EXISTS` blocks.
  - Unique index `uq_applications_student_job`: Ensures zero duplicate job applications. (Warning: if existing test data in production contains duplicates, the index creation will fail unless deduplicated first).
  - Performance indexes: All well-indexed (`idx_applications_job_status`, `idx_jobs_company_active`, `idx_students_user_id`).
  - `submit_job_application()` RPC: `SECURITY DEFINER`, fixed `search_path`, atomic checks, handles `unique_violation` gracefully.

---

### Migration 4: `20261014_phase3_auth_rbac_hardening.sql`
- **Classification**: **VALID WITH WARNINGS**
- **Analysis**:
  - `handle_new_user()` enforces default role `'student'`.
  - **Conflict Warning**: Migration `20261008_auth_fix_rls_and_provisioning.sql` already binds `on_auth_user_created` to `handle_new_auth_user()`, which creates records in both `public.users` AND `public.students`/`public.alumni`. Replacing it with a function that only inserts into `public.users` breaks automated student profile provisioning.
  - `is_user_active()`: Clean helper with proper permissions and search_path.

---

### Migration 5: `20261014_phase4_student_readiness.sql`
- **Classification**: **VALID**
- **Analysis**:
  - Column existence checks: `readiness_score`, `skills`, `projects`, `certifications` are safely verified before altering.
  - `calculate_student_readiness()`: Implements the exact 5-factor mathematical formula (Profile 25%, Skills 35%, Tasks 25%, Drives 15%, Assessment bonus max 5%).
  - Dynamically checks if optional tables (`student_tasks`, `drive_round_results`, `attempts`) exist before querying, preventing execution failure if tables are absent.
  - Capped strictly at 100.0. Proper grants and fixed `search_path`.

---

### Migration 6: `20261014_phase5_recruitment_pipeline.sql`
- **Classification**: **INVALID (CRITICAL FIX REQUIRED)**
- **Analysis**:
  - Lines 12-19: `jobs_recruiter_manage_own` correctly scopes job management to the recruiter's company.
  - Lines 23-34: `applications_recruiter_update_status` correctly scopes application management to the recruiter's company.
  - Lines 100-120: `issue_placement_offer()` passes `v_job_id` into `drive_offers.drive_id`. In `20261007_placement_drives_management.sql`, `drive_offers.drive_id` has a foreign key constraint referencing `public.placement_drives(id)`, NOT `public.jobs(id)`. This will fail with a foreign key violation on non-drive jobs.

---

### Migration 7: `20261014_phase6_alumni_mentorship_realtime.sql`
- **Classification**: **VALID WITH WARNINGS**
- **Analysis**:
  - `chk_connections_no_self`: Prevents users from requesting mentorship from themselves.
  - `uq_connections_pair`: Canonical pairing constraint prevents simultaneous reciprocal requests.
  - `conversations`, `conversation_members`, `messages`: Tables created with `IF NOT EXISTS`.
  - `accept_mentorship_request()`: Atomic RPC with `FOR UPDATE` lock, verifies receiver identity, provisions direct conversation and members, emits notification.

---

### Migration 8: `20261014_phase6_1_security_verification.sql`
- **Classification**: **VALID WITH WARNINGS**
- **Analysis**:
  - `is_conversation_member()`: Eliminates RLS recursion on `conversation_members`.
  - Type Warning: `is_conversation_member(p_conversation_id UUID, p_user_id UUID)` takes `UUID`. In `20261008_realtime_cross_device_chat.sql`, `messages.conversation_id` is typed as `TEXT`. A casting mismatch will occur unless overloaded for `TEXT` or cast in the policy.
  - `has_accepted_mentorship()`: Validates accepted connection between participants.
  - Gated message RLS policies: Enforce membership and accepted mentorship.

---

### Migration 9: `20261014_phase6_2_webrtc_authorization.sql`
- **Classification**: **VALID**
- **Analysis**:
  - `authorize_webrtc_session()`: Implements all 6 security invariants:
    1. Authenticated caller (`auth.uid() IS NOT NULL`)
    2. Self-call prevention (`auth.uid() <> p_peer_id`)
    3. Caller conversation membership check
    4. Peer conversation membership check
    5. Accepted mentorship connection check (supports dynamic `connection_type`)
    6. Returns clean JSONB response (`authorized: true/false`).
  - Permissions strictly revoked from `PUBLIC`, granted to `authenticated, service_role`.
  - Fully compatible with `CallService` frontend integration.

---

## 3. Discovered Defects & Recommended Fixes

### DEFECT 1: Recruiter Cross-Company Scope Bypass
- **FILE**: `supabase/migrations/20261014_phase1_1_security_gap_fixes.sql`
- **LINE**: 21
- **OBJECT**: Policy `students_recruiter_scoped_access`
- **PROBLEM**: Contains `OR public.get_auth_role() = 'recruiter'` inside the company ownership check.
- **WHY IT MATTERS**: Any authenticated user with the recruiter role can view every applicant across all companies.
- **RECOMMENDED FIX**: Remove `OR public.get_auth_role() = 'recruiter'`:
  ```sql
  CREATE POLICY "students_recruiter_scoped_access"
      ON public.students FOR SELECT
      USING (
          EXISTS (
              SELECT 1 
              FROM public.applications a
              JOIN public.jobs j ON a.job_id = j.id
              JOIN public.companies c ON j.company_id = c.id
              WHERE a.student_id = students.id
                AND c.user_id = auth.uid()
          )
          OR public.get_auth_role() IN ('admin', 'tpo')
      );
  ```

---

### DEFECT 2: Foreign Key Violation in `issue_placement_offer`
- **FILE**: `supabase/migrations/20261014_phase5_recruitment_pipeline.sql`
- **LINE**: 113
- **OBJECT**: Function `public.issue_placement_offer()`
- **PROBLEM**: Inserts `v_job_id` into `drive_offers.drive_id`. `drive_offers.drive_id` has an FK referencing `placement_drives(id)`.
- **WHY IT MATTERS**: Running `issue_placement_offer` for any standard job application triggers a PostgreSQL foreign key violation and rolls back the transaction.
- **RECOMMENDED FIX**: Check if `v_job_id` exists in `placement_drives` before inserting into `drive_offers`, or resolve the associated `drive_id`:
  ```sql
  -- Only record in drive_offers if drive exists
  IF EXISTS (SELECT 1 FROM public.placement_drives WHERE id = v_job_id) THEN
      INSERT INTO public.drive_offers (
          drive_id, student_id, student_name, student_email,
          company_name, role_designation, ctc_package, status, created_at, updated_at
      ) VALUES (
          v_job_id, v_student_id, v_student_name, COALESCE(v_student_email, ''),
          v_company_name, v_job_title, p_package, 'Offered', NOW(), NOW()
      ) ON CONFLICT DO NOTHING;
  END IF;
  ```

---

### DEFECT 3: Type Mismatch on `conversation_id` in Message RLS
- **FILE**: `supabase/migrations/20261014_phase6_1_security_verification.sql`
- **LINE**: 26, 88, 102
- **OBJECT**: Function `is_conversation_member` & policies `messages_select_gated`, `messages_insert_gated`
- **PROBLEM**: `is_conversation_member(p_conversation_id UUID, ...)` requires `UUID`, but historical `public.messages.conversation_id` is typed as `TEXT`.
- **WHY IT MATTERS**: Queries to `public.messages` will crash with: `function is_conversation_member(text, uuid) does not exist`.
- **RECOMMENDED FIX**: Overload `is_conversation_member` to accept `TEXT` as well, or cast in the policy:
  ```sql
  CREATE OR REPLACE FUNCTION public.is_conversation_member(p_conversation_id TEXT, p_user_id UUID)
  RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
      SELECT EXISTS (
          SELECT 1 FROM public.conversation_members 
          WHERE conversation_id::text = p_conversation_id AND user_id = p_user_id
      );
  $$;
  ```

---

### DEFECT 4: Student Provisioning Trigger Overwrite
- **FILE**: `supabase/migrations/20261014_phase3_auth_rbac_hardening.sql`
- **LINE**: 44-47
- **OBJECT**: Trigger `on_auth_user_created`
- **PROBLEM**: Drops and replaces `on_auth_user_created`, discarding the student record creation logic present in `handle_new_auth_user()`.
- **WHY IT MATTERS**: New signups will have a row in `public.users`, but their corresponding `public.students` row will never be created, breaking the student dashboard.
- **RECOMMENDED FIX**: Merge the role forcing (`NEW.raw_user_meta_data->>'role'` sanitized to `'student'`) into the existing `handle_new_auth_user()` routine.

---

## 4. Required Fixes Summary Table

| Migration | Issue Severity | Description | Fix Type |
| :--- | :---: | :--- | :--- |
| `20261014_phase1_1` | **CRITICAL** | Recruiter company isolation bypass via `OR role = 'recruiter'` | Modify RLS Policy |
| `20261014_phase5` | **CRITICAL** | `v_job_id` inserted into `drive_offers.drive_id` FK | Add drive existence check in RPC |
| `20261014_phase6_1` | **CRITICAL** | `messages.conversation_id` is TEXT while `is_conversation_member` expects UUID | Add TEXT overload for helper |
| `20261014_phase3` | **HIGH** | `handle_new_user` trigger drops student profile provisioning | Preserve `public.students` insert |

---

## 5. Execution Confirmation

```
SUPABASE MIGRATIONS EXECUTED: NO
LIVE DATABASE MODIFIED: NO
DATA DELETED: NO
DATABASE RESET: NO
```
