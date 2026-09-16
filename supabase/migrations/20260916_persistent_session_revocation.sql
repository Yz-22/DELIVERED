-- Migration: Persistent Session Revocation Table for Delivere / Dargo
-- Description: Stores revoked session JTIs (JSON Web Tokens IDs) across distributed instances.

CREATE TABLE IF NOT EXISTS public.revoked_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jti TEXT NOT NULL UNIQUE,
    user_id UUID NULL,
    revoked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    reason TEXT NULL DEFAULT 'logout',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance & Lookup Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_revoked_sessions_jti ON public.revoked_sessions (jti);
CREATE INDEX IF NOT EXISTS idx_revoked_sessions_expires_at ON public.revoked_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_revoked_sessions_user_id ON public.revoked_sessions (user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.revoked_sessions ENABLE ROW LEVEL SECURITY;

-- Security Policy: Restrict direct public manipulation, backend Service Role bypasses RLS
DROP POLICY IF EXISTS "No public access to revoked_sessions" ON public.revoked_sessions;
CREATE POLICY "No public access to revoked_sessions" ON public.revoked_sessions
    FOR ALL
    USING (false);

-- Cleanup function for expired revoked sessions to prevent table bloat
CREATE OR REPLACE FUNCTION public.cleanup_expired_revoked_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.revoked_sessions
    WHERE expires_at < now();
END;
$$;
