-- ============================================================================
-- CAREERNEXUS MIGRATION — REAL-TIME NOTIFICATIONS & CHAT ENHANCEMENTS
-- File: supabase/migrations/20261115_notifications_and_chat_enhancements.sql
-- Description:
--   1. Ensures messages has message_text, message_type, is_read, updated_at
--   2. Adds RLS UPDATE policy on messages for read receipts
--   3. Adds sender_id, reference_type, reference_id to notifications
--   4. Configures RLS policies on notifications allowing cross-user delivery
--   5. Ensures FULL replica identity and publication to supabase_realtime
--   6. Implements get_or_create_mentorship_conversation RPC
-- ============================================================================

BEGIN;

-- 1. Ensure columns exist on public.messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_text TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Keep content and message_text synchronized
UPDATE public.messages SET message_text = content WHERE message_text IS NULL;
UPDATE public.messages SET content = message_text WHERE content IS NULL;
UPDATE public.messages SET is_read = (read_at IS NOT NULL) WHERE is_read IS NULL;

-- 2. Message read/update policy
DROP POLICY IF EXISTS "messages_update_read" ON public.messages;
CREATE POLICY "messages_update_read" ON public.messages
FOR UPDATE TO authenticated
USING (
    receiver_id = auth.uid()
    OR sender_id = auth.uid()
    OR public.get_user_role(auth.uid()) = 'admin'
)
WITH CHECK (
    receiver_id = auth.uid()
    OR sender_id = auth.uid()
    OR public.get_user_role(auth.uid()) = 'admin'
);

-- 3. Ensure columns exist on public.notifications
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS reference_type TEXT DEFAULT 'general';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS reference_id TEXT DEFAULT '';

-- 4. RLS on public.notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;

CREATE POLICY "notifications_select" ON public.notifications
FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR sender_id = auth.uid()
    OR public.get_user_role(auth.uid()) = 'admin'
);

CREATE POLICY "notifications_insert" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() IS NOT NULL
);

CREATE POLICY "notifications_update" ON public.notifications
FOR UPDATE TO authenticated
USING (
    user_id = auth.uid()
    OR public.get_user_role(auth.uid()) = 'admin'
)
WITH CHECK (
    user_id = auth.uid()
    OR public.get_user_role(auth.uid()) = 'admin'
);

CREATE POLICY "notifications_delete" ON public.notifications
FOR DELETE TO authenticated
USING (
    user_id = auth.uid()
    OR public.get_user_role(auth.uid()) = 'admin'
);

-- 5. Realtime replica identity
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

-- 6. Helper RPC get_or_create_mentorship_conversation
CREATE OR REPLACE FUNCTION public.get_or_create_mentorship_conversation(
    p_student_id UUID,
    p_mentor_id UUID
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT 'conv-mentorship-' || LEAST(p_student_id::text, p_mentor_id::text) || '_' || GREATEST(p_student_id::text, p_mentor_id::text);
$$;

REVOKE ALL ON FUNCTION public.get_or_create_mentorship_conversation(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_mentorship_conversation(UUID, UUID) TO authenticated, service_role;

-- 7. Record migration in schema_migrations
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20261115144500', 'notifications_and_chat_enhancements', ARRAY['-- notifications and chat enhancements'])
ON CONFLICT (version) DO NOTHING;

COMMIT;
