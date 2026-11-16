-- ============================================================================
-- CAREERNEXUS MIGRATION — PHASE 6.1: SECURITY VERIFICATION & HELPERS
-- File: supabase/migrations/20261014_phase6_1_security_verification.sql
-- Description: Eliminates conversation_members RLS recursion, provides both
--              UUID and TEXT overloads for is_conversation_member(), and
--              hardens chat access with explicit mentorship verification.
-- Note: authorize_webrtc_session() is managed exclusively by Phase 6.2.
-- ============================================================================

BEGIN;

-- 1. Ensure connection_type column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'connections' 
          AND column_name = 'connection_type'
    ) THEN
        ALTER TABLE public.connections ADD COLUMN connection_type VARCHAR(50) NOT NULL DEFAULT 'mentorship';
    END IF;
END $$;

-- 2.1 Non-recursive conversation membership helper (UUID overload)
CREATE OR REPLACE FUNCTION public.is_conversation_member(
    p_conversation_id UUID, 
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.conversation_members 
        WHERE conversation_id = p_conversation_id 
          AND user_id = p_user_id
    );
$$;

REVOKE ALL ON FUNCTION public.is_conversation_member(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(UUID, UUID) TO authenticated, service_role;

-- 2.2 Safe TEXT overload for is_conversation_member()
-- Fix: Accommodates historical messages.conversation_id column typed as TEXT
CREATE OR REPLACE FUNCTION public.is_conversation_member(
    p_conversation_id TEXT, 
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.conversation_members 
        WHERE conversation_id::text = p_conversation_id 
          AND user_id = p_user_id
    );
$$;

REVOKE ALL ON FUNCTION public.is_conversation_member(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(TEXT, UUID) TO authenticated, service_role;

-- 3. Accepted mentorship validation helper (Explicitly checks connection_type = 'mentorship')
CREATE OR REPLACE FUNCTION public.has_accepted_mentorship(
    p_user_a UUID, 
    p_user_b UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.connections
        WHERE (
            (requester_id = p_user_a AND receiver_id = p_user_b) 
            OR 
            (requester_id = p_user_b AND receiver_id = p_user_a)
        )
        AND status = 'accepted'
        AND (connection_type = 'mentorship' OR connection_type IS NULL)
    );
$$;

REVOKE ALL ON FUNCTION public.has_accepted_mentorship(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_accepted_mentorship(UUID, UUID) TO authenticated, service_role;

-- 4. Hardened non-recursive RLS policy on conversation_members
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conv_members_select_safe" ON public.conversation_members;
CREATE POLICY "conv_members_select_safe"
    ON public.conversation_members FOR SELECT
    USING (
        user_id = auth.uid() 
        OR public.is_conversation_member(conversation_id, auth.uid())
    );

-- 5. Hardened messages RLS (Requires membership AND accepted mentorship)
-- Uses TEXT comparison on conversation_id for cross-version schema safety
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_gated" ON public.messages;
CREATE POLICY "messages_select_gated"
    ON public.messages FOR SELECT
    USING (
        public.is_conversation_member(conversation_id, auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.conversation_members peer
            WHERE peer.conversation_id::text = messages.conversation_id::text
              AND peer.user_id <> auth.uid()
              AND public.has_accepted_mentorship(auth.uid(), peer.user_id)
        )
    );

DROP POLICY IF EXISTS "messages_insert_gated" ON public.messages;
CREATE POLICY "messages_insert_gated"
    ON public.messages FOR INSERT
    WITH CHECK (
        sender_id = auth.uid()
        AND public.is_conversation_member(conversation_id, auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.conversation_members peer
            WHERE peer.conversation_id::text = messages.conversation_id::text
              AND peer.user_id <> auth.uid()
              AND public.has_accepted_mentorship(auth.uid(), peer.user_id)
        )
    );

COMMIT;
