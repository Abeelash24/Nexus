-- ============================================================================
-- CAREERNEXUS MIGRATION — 3D SAVED CONFIGURATIONS & TASKS RLS HARDENING
-- File: supabase/migrations/20261115_saved_configurations_and_tasks.sql
-- Description:
--   1. Creates public.saved_configurations for cross-app 3D builds sync
--   2. Creates public.tasks table with RLS for mobile tasks screen
--   3. Configures user-scoped Row-Level Security (auth.uid() = user_id)
--   4. Grants publication to supabase_realtime
-- ============================================================================

BEGIN;

-- 1. Create public.saved_configurations
CREATE TABLE IF NOT EXISTS public.saved_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL DEFAULT 'Nexus CyberCore Pro',
    material_preset TEXT NOT NULL DEFAULT 'cyber_cyan',
    hex_color TEXT NOT NULL DEFAULT '#00ffff',
    engraving_text TEXT DEFAULT '',
    engraving_style TEXT DEFAULT 'cyan',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_saved_configurations_user_id ON public.saved_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_configurations_created_at ON public.saved_configurations(created_at DESC);

-- Enable RLS
ALTER TABLE public.saved_configurations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "saved_configurations_select" ON public.saved_configurations;
DROP POLICY IF EXISTS "saved_configurations_insert" ON public.saved_configurations;
DROP POLICY IF EXISTS "saved_configurations_update" ON public.saved_configurations;
DROP POLICY IF EXISTS "saved_configurations_delete" ON public.saved_configurations;

-- Policies for public.saved_configurations
CREATE POLICY "saved_configurations_select" ON public.saved_configurations
FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR public.get_user_role(auth.uid()) = 'admin'
);

CREATE POLICY "saved_configurations_insert" ON public.saved_configurations
FOR INSERT TO authenticated
WITH CHECK (
    user_id = auth.uid()
    OR public.get_user_role(auth.uid()) = 'admin'
);

CREATE POLICY "saved_configurations_update" ON public.saved_configurations
FOR UPDATE TO authenticated
USING (
    user_id = auth.uid()
    OR public.get_user_role(auth.uid()) = 'admin'
)
WITH CHECK (
    user_id = auth.uid()
    OR public.get_user_role(auth.uid()) = 'admin'
);

CREATE POLICY "saved_configurations_delete" ON public.saved_configurations
FOR DELETE TO authenticated
USING (
    user_id = auth.uid()
    OR public.get_user_role(auth.uid()) = 'admin'
);

-- 2. Create public.tasks table for student tasks
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    due_date TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending',
    priority TEXT DEFAULT 'medium',
    category TEXT DEFAULT 'placement',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;

CREATE POLICY "tasks_select" ON public.tasks
FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR public.get_user_role(auth.uid()) = 'admin'
);

CREATE POLICY "tasks_insert" ON public.tasks
FOR INSERT TO authenticated
WITH CHECK (
    user_id = auth.uid()
    OR public.get_user_role(auth.uid()) = 'admin'
);

CREATE POLICY "tasks_update" ON public.tasks
FOR UPDATE TO authenticated
USING (
    user_id = auth.uid()
    OR public.get_user_role(auth.uid()) = 'admin'
)
WITH CHECK (
    user_id = auth.uid()
    OR public.get_user_role(auth.uid()) = 'admin'
);

CREATE POLICY "tasks_delete" ON public.tasks
FOR DELETE TO authenticated
USING (
    user_id = auth.uid()
    OR public.get_user_role(auth.uid()) = 'admin'
);

-- 3. Replica Identity & Realtime Publication
ALTER TABLE public.saved_configurations REPLICA IDENTITY FULL;
ALTER TABLE public.tasks REPLICA IDENTITY FULL;

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_configurations;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

-- 4. Seed default tasks for existing students if table is empty
INSERT INTO public.tasks (user_id, title, description, due_date, status, priority, category)
SELECT 
    u.id,
    task.title,
    task.description,
    NOW() + task.interval_offset,
    'pending',
    task.priority,
    task.category
FROM public.users u
CROSS JOIN (
    VALUES 
        ('Complete 3D Placement Profile', 'Finish filling out skills, projects, and certifications.', INTERVAL '2 days', 'high', 'profile'),
        ('Upload Verified Resume PDF', 'Upload your latest single-page tech resume to the secure portal.', INTERVAL '3 days', 'high', 'resume'),
        ('Customize 3D Tech Core Config', 'Build and save your custom laser-engraved CareerNexus CyberCore in the 3D Configurator.', INTERVAL '5 days', 'medium', 'tech_build'),
        ('Review Active Placement Drives', 'Explore upcoming campus placement drives and apply before registration closes.', INTERVAL '7 days', 'medium', 'placement')
) AS task(title, description, interval_offset, priority, category)
WHERE u.role = 'student'
  AND NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.user_id = u.id);

COMMIT;
