BEGIN;

CREATE TABLE IF NOT EXISTS public.waitlist_member_sessions (
    token_hash TEXT PRIMARY KEY CHECK (length(token_hash) = 64),
    member_id UUID NOT NULL REFERENCES public.market_waitlist(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS waitlist_member_sessions_member_idx
    ON public.waitlist_member_sessions (member_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.waitlist_member_restore_attempts (
    request_hash TEXT PRIMARY KEY CHECK (length(request_hash) = 64),
    window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0)
);

ALTER TABLE public.waitlist_member_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_member_restore_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.waitlist_member_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.waitlist_member_sessions TO service_role;
REVOKE ALL ON public.waitlist_member_restore_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.waitlist_member_restore_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.restore_waitlist_member_session(
    p_full_name TEXT,
    p_phone_last_three TEXT,
    p_session_token_hash TEXT,
    p_request_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    recovered_member_id UUID;
    matched_members INTEGER;
    current_attempts INTEGER;
BEGIN
    IF length(trim(p_full_name)) < 2 OR p_phone_last_three !~ '^[0-9]{3}$'
        OR p_session_token_hash !~ '^[0-9a-f]{64}$'
        OR p_request_hash !~ '^[0-9a-f]{64}$' THEN
        RETURN jsonb_build_object('member_id', NULL, 'rate_limited', false);
    END IF;

    INSERT INTO public.waitlist_member_restore_attempts (request_hash, window_started_at, attempt_count)
    VALUES (p_request_hash, now(), 1)
    ON CONFLICT (request_hash) DO UPDATE
    SET window_started_at = CASE
            WHEN public.waitlist_member_restore_attempts.window_started_at < now() - INTERVAL '15 minutes'
                THEN now()
            ELSE public.waitlist_member_restore_attempts.window_started_at
        END,
        attempt_count = CASE
            WHEN public.waitlist_member_restore_attempts.window_started_at < now() - INTERVAL '15 minutes'
                THEN 1
            ELSE public.waitlist_member_restore_attempts.attempt_count + 1
        END
    RETURNING attempt_count INTO current_attempts;

    IF current_attempts > 10 THEN
        RETURN jsonb_build_object('member_id', NULL, 'rate_limited', true);
    END IF;

    SELECT count(*)::INTEGER, (array_agg(id ORDER BY created_at DESC))[1]
    INTO matched_members, recovered_member_id
    FROM public.market_waitlist
    WHERE lower(trim(full_name)) = lower(trim(p_full_name))
        AND right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 3) = p_phone_last_three
        AND length(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) >= 3;

    IF matched_members <> 1 OR recovered_member_id IS NULL THEN
        RETURN jsonb_build_object('member_id', NULL, 'rate_limited', false);
    END IF;

    INSERT INTO public.waitlist_member_sessions (token_hash, member_id)
    VALUES (p_session_token_hash, recovered_member_id);

    DELETE FROM public.waitlist_member_sessions
    WHERE member_id = recovered_member_id
        AND token_hash NOT IN (
            SELECT token_hash
            FROM public.waitlist_member_sessions
            WHERE member_id = recovered_member_id
            ORDER BY created_at DESC
            LIMIT 10
        );

    RETURN jsonb_build_object('member_id', recovered_member_id, 'rate_limited', false);
END;
$$;

REVOKE ALL ON FUNCTION public.restore_waitlist_member_session(TEXT, TEXT, TEXT, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_waitlist_member_session(TEXT, TEXT, TEXT, TEXT)
    TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
