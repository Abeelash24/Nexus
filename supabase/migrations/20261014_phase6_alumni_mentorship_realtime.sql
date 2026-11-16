-- ============================================================================
-- CAREERNEXUS MIGRATION — PHASE 6: ALUMNI MENTORSHIP & REALTIME
-- File: supabase/migrations/20261014_phase6_alumni_mentorship_realtime.sql
-- Description: Mentorship request gating, self-request prevention, conversations,
--              conversation members, atomic acceptance, and messaging setup.
-- ============================================================================

BEGIN;

-- 1. Prevent self-connections
ALTER TABLE public.connections 
    DROP CONSTRAINT IF EXISTS chk_connections_no_self;
ALTER TABLE public.connections 
    ADD CONSTRAINT chk_connections_no_self CHECK (requester_id <> receiver_id);

-- 2. Prevent duplicate connections between identical pairs
CREATE UNIQUE INDEX IF NOT EXISTS uq_connections_pair 
    ON public.connections (LEAST(requester_id, receiver_id), GREATEST(requester_id, receiver_id));

-- 3. Ensure conversation and message tables exist
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL DEFAULT 'direct',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conversation_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_conversation_member UNIQUE (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(TRIM(content)) > 0 AND char_length(content) <= 5000),
    attachment_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_read BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created 
    ON public.messages (conversation_id, created_at ASC);

-- 4. Atomic mentorship acceptance RPC
CREATE OR REPLACE FUNCTION public.accept_mentorship_request(p_connection_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_requester_id UUID;
    v_receiver_id UUID;
    v_status TEXT;
    v_conversation_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;

    -- Lock and verify connection
    SELECT requester_id, receiver_id, status
    INTO v_requester_id, v_receiver_id, v_status
    FROM public.connections
    WHERE id = p_connection_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Connection request not found');
    END IF;

    -- Verify receiver identity
    IF v_receiver_id <> auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only receiver can accept');
    END IF;

    IF v_status = 'accepted' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already accepted');
    END IF;

    -- Update connection status
    UPDATE public.connections
    SET status = 'accepted', accepted_at = NOW(), updated_at = NOW()
    WHERE id = p_connection_id;

    -- Locate existing direct conversation or create new one
    SELECT cm1.conversation_id INTO v_conversation_id
    FROM public.conversation_members cm1
    JOIN public.conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
    JOIN public.conversations c ON c.id = cm1.conversation_id
    WHERE cm1.user_id = v_requester_id 
      AND cm2.user_id = v_receiver_id
      AND c.type = 'direct'
    LIMIT 1;

    IF v_conversation_id IS NULL THEN
        INSERT INTO public.conversations (type, created_at, updated_at)
        VALUES ('direct', NOW(), NOW())
        RETURNING id INTO v_conversation_id;

        INSERT INTO public.conversation_members (conversation_id, user_id, joined_at)
        VALUES 
            (v_conversation_id, v_requester_id, NOW()),
            (v_conversation_id, v_receiver_id, NOW());
    END IF;

    -- Send notification to requester
    INSERT INTO public.notifications (user_id, title, message, type, metadata, created_at)
    VALUES (
        v_requester_id,
        'Mentorship Accepted',
        'Your mentorship request has been accepted. You can now chat and schedule calls.',
        'mentorship_accepted',
        jsonb_build_object('connection_id', p_connection_id, 'conversation_id', v_conversation_id),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true, 
        'connection_id', p_connection_id, 
        'conversation_id', v_conversation_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_mentorship_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_mentorship_request(UUID) TO authenticated, service_role;

COMMIT;
