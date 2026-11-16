-- ============================================================================
-- CAREERNEXUS MIGRATION — NOTIFICATIONS RLS INSERT POLICY HARDENING
-- File: supabase/migrations/20261116_notifications_rls_hardening.sql
-- Description:
--   Tightens public.notifications INSERT policy so that authenticated callers
--   can only insert notifications with sender_id matching their own auth.uid(),
--   strictly preventing notification spoofing under another user's sender_id.
-- ============================================================================

BEGIN;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;

CREATE POLICY "notifications_insert" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() IS NOT NULL
    AND sender_id = auth.uid()
);

-- Notify PostgREST schema cache to reload
NOTIFY pgrst, 'reload schema';

COMMIT;
