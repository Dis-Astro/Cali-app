-- Preserve the secretary role found in the Lovable Cloud production data.
-- Application permissions remain explicit: this migration does not grant admin access.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'segretaria';
