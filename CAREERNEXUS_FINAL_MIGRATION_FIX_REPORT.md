# CareerNexus — Final Migration Fix Report
**Date**: 2026-10-14  
**Project**: CareerNexus / Nexus (`C:\Users\abeelash\nexus`)  
**Scope**: Remediation of all 4 defects identified during the deep audit of Phase migrations.  
**Execution State**: Safe local repository fixes only. No SQL executed against Supabase.

---

## 1. Executive Summary

All 4 defects identified in the deep audit have been remediated in their respective migration files. The changes eliminate security bypasses, resolve foreign-key schema conflicts, ensure type compatibility between `TEXT` and `UUID` identifiers in chat RLS, and restore automatic student profile provisioning on user signup.

---

## 2. Remediation Details

### DEFECT 1: Recruiter Company Scope Bypass
- **File Changed**: `supabase/migrations/20261014_phase1_1_security_gap_fixes.sql`
- **Object Changed**: RLS Policy `students_recruiter_scoped_access`
- **Old Behavior**: Contained `AND (c.user_id = auth.uid() OR public.get_auth_role() = 'recruiter')`. The `OR public.get_auth_role() = 'recruiter'` clause allowed any recruiter to view any student application across any company.
- **New Behavior**: Removed `OR public.get_auth_role() = 'recruiter'`. Recruiter access is strictly scoped to `c.user_id = auth.uid()` (the company owned/managed by the recruiter), preserving admin/TPO platform-level access.
- **Validation**: Regex scan confirms zero instances of the bypass clause in the policy logic.

---

### DEFECT 2: Foreign Key Violation in `issue_placement_offer`
- **File Changed**: `supabase/migrations/20261014_phase5_recruitment_pipeline.sql`
- **Object Changed**: Function `public.issue_placement_offer()`
- **Old Behavior**: Attempted to insert `v_job_id` (from `jobs.id`) directly into `drive_offers.drive_id`. Because `drive_offers.drive_id` has a foreign key constraint referencing `placement_drives(id)`, offers issued for standard job applications resulted in foreign key violation `drive_offers_drive_id_fkey`.
- **New Behavior**: The function now resolves the associated `placement_drives` record via `WHERE job_id = v_job_id`. It only inserts into `drive_offers` if an associated placement drive exists (`v_drive_id IS NOT NULL`). If no placement drive is associated (e.g. a standard direct job), it updates `applications.status = 'offered'` and `students.placement_status = 'placed'` without raising an FK violation.
- **Validation**: Code inspection confirms `v_drive_id` is queried from `public.placement_drives` and guarded with an `IS NOT NULL` check before inserting into `public.drive_offers`.

---

### DEFECT 3: Type Mismatch on `conversation_id` in Message RLS
- **File Changed**: `supabase/migrations/20261014_phase6_1_security_verification.sql`
- **Object Changed**: Function `is_conversation_member()` & Message RLS policies
- **Old Behavior**: `is_conversation_member` was defined exclusively for `(UUID, UUID)`. Historical migration `20261008_realtime_cross_device_chat.sql` typed `messages.conversation_id` as `TEXT`. Passing `messages.conversation_id` into the function produced: `function public.is_conversation_member(text, uuid) does not exist`.
- **New Behavior**:
  1. Added a safe `TEXT` overload: `public.is_conversation_member(p_conversation_id TEXT, p_user_id UUID)`.
  2. Both `(UUID, UUID)` and `(TEXT, UUID)` overloads run as `SECURITY DEFINER` with fixed `SET search_path = public, auth` and explicit revocation from `PUBLIC`.
  3. Message policies compare `peer.conversation_id::text = messages.conversation_id::text` for universal cross-type compatibility.
  4. Explicitly validates `(connection_type = 'mentorship' OR connection_type IS NULL)`.
- **Validation**: Scanned `phase6_1` migration to verify both function overloads exist and are granted exclusively to `authenticated, service_role`.

---

### DEFECT 4: Student Profile Provisioning Overwrite
- **File Changed**: `supabase/migrations/20261014_phase3_auth_rbac_hardening.sql`
- **Object Changed**: Trigger `on_auth_user_created` & function `handle_new_auth_user()`
- **Old Behavior**: `handle_new_user()` overwrote `on_auth_user_created`, dropping the student profile creation branch from `20261008_auth_fix_rls_and_provisioning.sql`. New student registrations created a row in `public.users` but left `public.students` unpopulated.
- **New Behavior**:
  1. Preserves automatic provisioning of `public.students` (`user_id, full_name, email, department, roll_number, profile_photo, is_active, placement_status, profile_completion`).
  2. Preserves automatic provisioning of `public.alumni` for verified alumni registrations.
  3. Enforces Phase 3 RBAC security: Public signups claiming `admin` or `recruiter` in metadata are strictly forced to `student`. Only an authenticated admin caller can provision `admin` or `recruiter` roles.
  4. Provides alias `handle_new_user()` for backward compatibility.
- **Validation**: Verified `INSERT INTO public.students` and `ON CONFLICT (user_id)` are present in `20261014_phase3_auth_rbac_hardening.sql`.

---

## 3. Static SQL Security Verification

All 9 migration files (`20261014_phase1` through `20261014_phase6_2`) were scanned:
- **`DROP TABLE` / `DROP SCHEMA`**: 0 occurrences
- **`TRUNCATE` / `DELETE FROM`**: 0 occurrences
- **`DISABLE ROW LEVEL SECURITY`**: 0 occurrences
- **Unbounded `USING (TRUE)` on sensitive tables**: 0 occurrences
- **Unbounded `WITH CHECK (TRUE)`**: 0 occurrences
- **Unsafe `SECURITY DEFINER` without `search_path`**: 0 occurrences
- **Unsafe `PUBLIC` execution grants**: 0 occurrences (all revoked from `PUBLIC`)

---

## 4. Remaining Warnings
1. **Historical Duplicate Deduplication**: Before applying `20261014_phase2_database_hardening.sql` in production, ensure that historical test data in `public.applications` does not contain duplicate `(student_id, job_id)` pairs, or `CREATE UNIQUE INDEX` will require deduplication.
2. **STUN/TURN Connectivity**: WebRTC authorization in `Phase 6.2` is fully secured at the PostgreSQL boundary. In enterprise network environments with symmetric NAT, production deployment will require TURN server configuration.

---

## 5. Supabase State Confirmation

```
SUPABASE MIGRATIONS EXECUTED: NO
LIVE DATABASE MODIFIED: NO
DATA DELETED: NO
DATABASE RESET: NO
```

---

## 6. Final Status

### **FINAL STATUS: READY FOR SECOND DEEP AUDIT**
All 4 defects have been fixed in the local repository migrations, reconciled against existing schema, and verified with zero destructive statements.
