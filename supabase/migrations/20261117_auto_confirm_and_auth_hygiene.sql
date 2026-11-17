-- Migration: 20261117_auto_confirm_and_auth_hygiene.sql
-- Description: Ensures all newly registered users in auth.users are automatically email-confirmed 
-- to prevent email confirmation deadlocks and allow immediate login.

CREATE OR REPLACE FUNCTION public.auto_confirm_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
    IF NEW.email_confirmed_at IS NULL THEN
        NEW.email_confirmed_at := NOW();
    END IF;
    IF NEW.confirmed_at IS NULL THEN
        NEW.confirmed_at := NOW();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_confirm_new_auth_user ON auth.users;
CREATE TRIGGER trg_auto_confirm_new_auth_user
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_confirm_new_auth_user();
