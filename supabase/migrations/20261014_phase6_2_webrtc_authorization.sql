-- ============================================================================
-- CAREERNEXUS DATABASE MIGRATION — PHASE 6.2
-- File: supabase/migrations/20261014_phase6_2_webrtc_authorization.sql
-- Description: WebRTC Backend Authorization RPC (authorize_webrtc_session)
-- ============================================================================

BEGIN;

-- 1. UUID Overload: authorize_webrtc_session(UUID, UUID)
CREATE OR REPLACE FUNCTION public.authorize_webrtc_session(
    p_conversation_id UUID,
    p_peer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
BEGIN
    -- 1. Caller authentication check
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

    -- 3. Verify caller is a member of the conversation
    IF NOT public.is_conversation_member(p_conversation_id, v_caller_id) THEN
        RETURN jsonb_build_object(
            'authorized', false, 
            'error', 'Caller is not a member of this conversation'
        );
    END IF;

    -- 4. Verify peer is a member of the conversation
    IF NOT public.is_conversation_member(p_conversation_id, p_peer_id) THEN
        RETURN jsonb_build_object(
            'authorized', false, 
            'error', 'Peer is not a member of this conversation'
        );
    END IF;

    -- 5. Verify active accepted mentorship connection
    IF NOT public.has_accepted_mentorship(v_caller_id, p_peer_id) THEN
        RETURN jsonb_build_object(
            'authorized', false, 
            'error', 'Active accepted mentorship connection required'
        );
    END IF;

    -- 6. Successful authorization
    RETURN jsonb_build_object(
        'authorized', true,
        'conversation_id', p_conversation_id,
        'caller_id', v_caller_id,
        'peer_id', p_peer_id,
        'channel_name', 'call_' || p_conversation_id::text
    );
END;
$$;

-- Secure execution permissions
REVOKE ALL ON FUNCTION public.authorize_webrtc_session(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.authorize_webrtc_session(UUID, UUID) TO authenticated, service_role;


-- 2. TEXT Overload: authorize_webrtc_session(TEXT, UUID)
-- Accommodates historical conversation identifiers typed as TEXT
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
BEGIN
    -- 1. Caller authentication check
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

    -- 3. Verify caller is a member of the conversation
    IF NOT public.is_conversation_member(p_conversation_id, v_caller_id) THEN
        RETURN jsonb_build_object(
            'authorized', false, 
            'error', 'Caller is not a member of this conversation'
        );
    END IF;

    -- 4. Verify peer is a member of the conversation
    IF NOT public.is_conversation_member(p_conversation_id, p_peer_id) THEN
        RETURN jsonb_build_object(
            'authorized', false, 
            'error', 'Peer is not a member of this conversation'
        );
    END IF;

    -- 5. Verify active accepted mentorship connection
    IF NOT public.has_accepted_mentorship(v_caller_id, p_peer_id) THEN
        RETURN jsonb_build_object(
            'authorized', false, 
            'error', 'Active accepted mentorship connection required'
        );
    END IF;

    -- 6. Successful authorization
    RETURN jsonb_build_object(
        'authorized', true,
        'conversation_id', p_conversation_id,
        'caller_id', v_caller_id,
        'peer_id', p_peer_id,
        'channel_name', 'call_' || p_conversation_id
    );
END;
$$;

-- Secure execution permissions
REVOKE ALL ON FUNCTION public.authorize_webrtc_session(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.authorize_webrtc_session(TEXT, UUID) TO authenticated, service_role;

COMMIT;
