-- ============================================================================
-- CAREERNEXUS MIGRATION — WEBRTC MENTORSHIP-GATED CALLS & SIGNALING HARDENING
-- File: supabase/migrations/20261116_webrtc_mentorship_gated_calls.sql
-- Description:
--   1. Ensures has_accepted_mentorship helper exists
--   2. Reconciles authorize_webrtc_session RPC for canonical call-room channels
--   3. Hardens RLS on public.calls strictly requiring accepted mentorship
--   4. Configures REPLICA IDENTITY FULL and Realtime publication on public.calls
-- ============================================================================

BEGIN;

-- 1. Helper function: has_accepted_mentorship
CREATE OR REPLACE FUNCTION public.has_accepted_mentorship(p_user1 UUID, p_user2 UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.connections conn
        WHERE (
            (conn.requester_id = p_user1 AND conn.receiver_id = p_user2)
            OR (conn.requester_id = p_user2 AND conn.receiver_id = p_user1)
        )
        AND conn.status = 'accepted'
    );
$$;

GRANT EXECUTE ON FUNCTION public.has_accepted_mentorship(UUID, UUID) TO authenticated, service_role;

-- 2. Helper function: is_conversation_member
CREATE OR REPLACE FUNCTION public.is_conversation_member(p_conversation_id TEXT, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_conversation_id LIKE 'conv-mentorship-%' OR p_conversation_id LIKE 'call-room:%' THEN
        RETURN p_conversation_id LIKE '%' || p_user_id::text || '%';
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'conversation_members'
    ) AND EXISTS (
        SELECT 1 FROM public.conversation_members
        WHERE conversation_id::text = p_conversation_id
          AND user_id = p_user_id
    );
EXCEPTION WHEN OTHERS THEN
    RETURN p_conversation_id LIKE '%' || p_user_id::text || '%';
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_conversation_member(TEXT, UUID) TO authenticated, service_role;

-- 3. Authorize WebRTC Session RPC: (p_peer_id UUID)
CREATE OR REPLACE FUNCTION public.authorize_webrtc_session(
    p_peer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_room_id TEXT;
BEGIN
    -- 1. Authentication check
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object(
            'authorized', false, 
            'error', 'Authentication required'
        );
    END IF;

    -- 2. Prevent self-calling
    IF v_caller_id = p_peer_id THEN
        RETURN jsonb_build_object(
            'authorized', false, 
            'error', 'Cannot initiate call to yourself'
        );
    END IF;

    v_caller_role := public.get_user_role(v_caller_id);

    -- 3. Verify active accepted mentorship connection (Admins bypass)
    IF v_caller_role != 'admin' AND NOT public.has_accepted_mentorship(v_caller_id, p_peer_id) THEN
        RETURN jsonb_build_object(
            'authorized', false, 
            'error', 'Active accepted mentorship connection required'
        );
    END IF;

    -- 4. Construct canonical sorted room channel identifier
    v_room_id := 'call-room:' || LEAST(v_caller_id::text, p_peer_id::text) || '_' || GREATEST(v_caller_id::text, p_peer_id::text);

    RETURN jsonb_build_object(
        'authorized', true,
        'caller_id', v_caller_id,
        'peer_id', p_peer_id,
        'room_id', v_room_id,
        'channel_name', v_room_id
    );
END;
$$;

-- 4. Overload with conversation_id: (p_conversation_id TEXT, p_peer_id UUID)
CREATE OR REPLACE FUNCTION public.authorize_webrtc_session(
    p_conversation_id TEXT,
    p_peer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_room_id TEXT;
BEGIN
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object(
            'authorized', false, 
            'error', 'Authentication required'
        );
    END IF;

    IF v_caller_id = p_peer_id THEN
        RETURN jsonb_build_object(
            'authorized', false, 
            'error', 'Cannot initiate call to yourself'
        );
    END IF;

    v_caller_role := public.get_user_role(v_caller_id);

    IF v_caller_role != 'admin' AND NOT public.has_accepted_mentorship(v_caller_id, p_peer_id) THEN
        RETURN jsonb_build_object(
            'authorized', false, 
            'error', 'Active accepted mentorship connection required'
        );
    END IF;

    v_room_id := 'call-room:' || LEAST(v_caller_id::text, p_peer_id::text) || '_' || GREATEST(v_caller_id::text, p_peer_id::text);

    RETURN jsonb_build_object(
        'authorized', true,
        'conversation_id', p_conversation_id,
        'caller_id', v_caller_id,
        'peer_id', p_peer_id,
        'room_id', v_room_id,
        'channel_name', v_room_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.authorize_webrtc_session(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.authorize_webrtc_session(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.authorize_webrtc_session(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.authorize_webrtc_session(TEXT, UUID) TO authenticated, service_role;

-- 5. Harden RLS on public.calls table
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants manage calls" ON public.calls;
DROP POLICY IF EXISTS "calls_select" ON public.calls;
DROP POLICY IF EXISTS "calls_insert" ON public.calls;
DROP POLICY IF EXISTS "calls_update" ON public.calls;
DROP POLICY IF EXISTS "calls_delete" ON public.calls;

CREATE POLICY "calls_select" ON public.calls
FOR SELECT TO authenticated
USING (
    caller_id = auth.uid()
    OR receiver_id = auth.uid()
    OR public.get_user_role(auth.uid()) = 'admin'
);

CREATE POLICY "calls_insert" ON public.calls
FOR INSERT TO authenticated
WITH CHECK (
    caller_id = auth.uid()
    AND (
        public.has_accepted_mentorship(caller_id, receiver_id)
        OR public.get_user_role(auth.uid()) = 'admin'
    )
);

CREATE POLICY "calls_update" ON public.calls
FOR UPDATE TO authenticated
USING (
    caller_id = auth.uid()
    OR receiver_id = auth.uid()
    OR public.get_user_role(auth.uid()) = 'admin'
)
WITH CHECK (
    caller_id = auth.uid()
    OR receiver_id = auth.uid()
    OR public.get_user_role(auth.uid()) = 'admin'
);

CREATE POLICY "calls_delete" ON public.calls
FOR DELETE TO authenticated
USING (
    caller_id = auth.uid()
    OR receiver_id = auth.uid()
    OR public.get_user_role(auth.uid()) = 'admin'
);

-- 6. Ensure REPLICA IDENTITY FULL on public.calls
ALTER TABLE public.calls REPLICA IDENTITY FULL;

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

COMMIT;
