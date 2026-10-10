-- Self-contained schema for the independently hosted early-access waitlist.
-- It creates the shared market_waitlist table when the demand migration has not
-- been installed yet, and safely extends that table when it already exists.

BEGIN;

CREATE TABLE IF NOT EXISTS public.market_waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    email TEXT NOT NULL,
    phone TEXT,
    country TEXT NOT NULL DEFAULT 'Kenya',
    county TEXT NOT NULL,
    city TEXT NOT NULL,
    area TEXT NOT NULL,
    notification_consent BOOLEAN NOT NULL DEFAULT false,
    source TEXT NOT NULL DEFAULT 'storefront',
    status TEXT NOT NULL DEFAULT 'WAITLIST',
    notified_at TIMESTAMPTZ,
    converted_to_user UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.market_waitlist
    ADD COLUMN IF NOT EXISTS user_id UUID,
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'Kenya',
    ADD COLUMN IF NOT EXISTS county TEXT,
    ADD COLUMN IF NOT EXISTS city TEXT,
    ADD COLUMN IF NOT EXISTS area TEXT,
    ADD COLUMN IF NOT EXISTS notification_consent BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'waitlist-website',
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'WAITLIST',
    ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS converted_to_user UUID,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS full_name TEXT,
    ADD COLUMN IF NOT EXISTS landmark TEXT,
    ADD COLUMN IF NOT EXISTS location_verified BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS location_accuracy_m NUMERIC,
    ADD COLUMN IF NOT EXISTS service_area_status TEXT NOT NULL DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS email_updates_consent BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS email_updates_consent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sms_consent BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS sms_consent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS whatsapp_consent BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS whatsapp_consent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT,
    ADD COLUMN IF NOT EXISTS product_interests TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS order_frequency TEXT,
    ADD COLUMN IF NOT EXISTS age_confirmed BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS age_confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS referral_code TEXT,
    ADD COLUMN IF NOT EXISTS referred_by_code TEXT,
    ADD COLUMN IF NOT EXISTS campaign TEXT,
    ADD COLUMN IF NOT EXISTS landing_page TEXT,
    ADD COLUMN IF NOT EXISTS reward_path TEXT,
    ADD COLUMN IF NOT EXISTS consent_version TEXT,
    ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS age_group TEXT;

ALTER TABLE public.market_waitlist
    ADD COLUMN IF NOT EXISTS member_access_token_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS market_waitlist_email_area_uidx
    ON public.market_waitlist (lower(email), lower(city), lower(area));
CREATE INDEX IF NOT EXISTS market_waitlist_location_created_idx
    ON public.market_waitlist (country, county, city, area, created_at DESC);

ALTER TABLE public.market_waitlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.market_waitlist FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.market_waitlist TO service_role;

CREATE TABLE IF NOT EXISTS public.waitlist_site_content (
    id TEXT PRIMARY KEY CHECK (id = 'default'),
    eyebrow TEXT NOT NULL DEFAULT 'A BETTER NIGHT STARTS HERE',
    headline TEXT NOT NULL DEFAULT 'Something good is coming.',
    intro TEXT NOT NULL DEFAULT 'Your next drink night is about to get a lot easier. Online Bar is bringing your favorites to your door, starting in selected areas.',
    benefit_one TEXT NOT NULL DEFAULT 'Priority access',
    benefit_two TEXT NOT NULL DEFAULT 'Launch surprises',
    benefit_three TEXT NOT NULL DEFAULT 'Area-first delivery',
    hero_image_url TEXT,
    hero_image_path TEXT,
    hero_image_alt TEXT NOT NULL DEFAULT 'Online Bar early access',
    age_group_tracks JSONB NOT NULL DEFAULT '{}'::JSONB,
    genre_tracks JSONB NOT NULL DEFAULT '{}'::JSONB,
    launch_at TIMESTAMPTZ,
    tokens_per_referral INTEGER NOT NULL DEFAULT 10,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.waitlist_site_content
    ADD COLUMN IF NOT EXISTS age_group_tracks JSONB NOT NULL DEFAULT '{}'::JSONB,
    ADD COLUMN IF NOT EXISTS genre_tracks JSONB NOT NULL DEFAULT '{}'::JSONB,
    ADD COLUMN IF NOT EXISTS launch_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS tokens_per_referral INTEGER NOT NULL DEFAULT 10,
    DROP CONSTRAINT IF EXISTS waitlist_site_content_tokens_per_referral_check,
    ADD CONSTRAINT waitlist_site_content_tokens_per_referral_check
        CHECK (tokens_per_referral BETWEEN 1 AND 1000);

ALTER TABLE public.waitlist_site_content ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.waitlist_site_content FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.waitlist_site_content TO service_role;

INSERT INTO public.waitlist_site_content (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.waitlist_site_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    image_url TEXT,
    image_path TEXT,
    token_cost INTEGER NOT NULL DEFAULT 10 CHECK (token_cost BETWEEN 1 AND 1000000),
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.waitlist_referral_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES public.market_waitlist(id) ON DELETE CASCADE,
    invitee_id UUID NOT NULL UNIQUE REFERENCES public.market_waitlist(id) ON DELETE CASCADE,
    token_amount INTEGER NOT NULL CHECK (token_amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (referrer_id <> invitee_id)
);

CREATE INDEX IF NOT EXISTS waitlist_referral_credits_referrer_idx
    ON public.waitlist_referral_credits (referrer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.waitlist_reward_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES public.market_waitlist(id) ON DELETE CASCADE,
    reward_id UUID NOT NULL REFERENCES public.waitlist_site_rewards(id) ON DELETE RESTRICT,
    tokens_spent INTEGER NOT NULL CHECK (tokens_spent > 0),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS waitlist_reward_claims_member_idx
    ON public.waitlist_reward_claims (referrer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS waitlist_reward_claims_status_idx
    ON public.waitlist_reward_claims (status, created_at DESC);

ALTER TABLE public.waitlist_site_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_referral_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_reward_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.waitlist_site_rewards, public.waitlist_referral_credits, public.waitlist_reward_claims
    FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.waitlist_site_rewards, public.waitlist_referral_credits, public.waitlist_reward_claims
    TO service_role;

CREATE OR REPLACE FUNCTION public.credit_waitlist_referral()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    referrer UUID;
    token_value INTEGER;
BEGIN
    IF NEW.referred_by_code IS NULL OR btrim(NEW.referred_by_code) = '' THEN
        RETURN NEW;
    END IF;

    SELECT member.id INTO referrer
    FROM public.market_waitlist AS member
    WHERE upper(member.referral_code) = upper(NEW.referred_by_code)
      AND lower(member.email) <> lower(NEW.email)
      AND member.id <> NEW.id
      AND NOT EXISTS (
          SELECT 1 FROM public.market_waitlist AS prior_signup
          WHERE prior_signup.id <> NEW.id
            AND lower(prior_signup.email) = lower(NEW.email)
      )
    ORDER BY member.created_at
    LIMIT 1;

    IF referrer IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT tokens_per_referral INTO token_value
    FROM public.waitlist_site_content
    WHERE id = 'default';

    INSERT INTO public.waitlist_referral_credits (referrer_id, invitee_id, token_amount)
    VALUES (referrer, NEW.id, COALESCE(token_value, 10))
    ON CONFLICT (invitee_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS market_waitlist_referral_credit ON public.market_waitlist;
CREATE TRIGGER market_waitlist_referral_credit
    AFTER INSERT ON public.market_waitlist
    FOR EACH ROW
    EXECUTE FUNCTION public.credit_waitlist_referral();

CREATE OR REPLACE FUNCTION public.request_waitlist_reward(p_referral_code TEXT, p_reward_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    member_id UUID;
    required_tokens INTEGER;
    available_tokens BIGINT;
    claim_id UUID;
BEGIN
    SELECT id INTO member_id
    FROM public.market_waitlist
    WHERE upper(referral_code) = upper(btrim(p_referral_code))
    ORDER BY created_at
    LIMIT 1
    FOR UPDATE;

    IF member_id IS NULL THEN
        RAISE EXCEPTION 'Referral link was not found.';
    END IF;

    SELECT token_cost INTO required_tokens
    FROM public.waitlist_site_rewards
    WHERE id = p_reward_id AND is_active = true;

    IF required_tokens IS NULL THEN
        RAISE EXCEPTION 'This souvenir is not available right now.';
    END IF;

    SELECT COALESCE((SELECT sum(token_amount) FROM public.waitlist_referral_credits WHERE referrer_id = member_id), 0)
        - COALESCE((SELECT sum(tokens_spent) FROM public.waitlist_reward_claims
                    WHERE referrer_id = member_id AND status IN ('pending', 'approved')), 0)
    INTO available_tokens;

    IF available_tokens < required_tokens THEN
        RAISE EXCEPTION 'You need % more tokens to request this souvenir.', required_tokens - available_tokens;
    END IF;

    INSERT INTO public.waitlist_reward_claims (referrer_id, reward_id, tokens_spent)
    VALUES (member_id, p_reward_id, required_tokens)
    RETURNING id INTO claim_id;

    RETURN claim_id;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_waitlist_referral() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_waitlist_reward(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_waitlist_reward(TEXT, UUID) TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'waitlist-site-images',
    'waitlist-site-images',
    true,
    6291456,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 6291456,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'waitlist-site-rewards',
    'waitlist-site-rewards',
    true,
    6291456,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 6291456,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'waitlist-site-audio',
    'waitlist-site-audio',
    true,
    10485760,
    ARRAY['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 10485760,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Public read waitlist site images'
    ) THEN
        CREATE POLICY "Public read waitlist site images"
            ON storage.objects FOR SELECT TO anon, authenticated
            USING (bucket_id = 'waitlist-site-images');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Public read waitlist site audio'
    ) THEN
        CREATE POLICY "Public read waitlist site audio"
            ON storage.objects FOR SELECT TO anon, authenticated
            USING (bucket_id = 'waitlist-site-audio');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Public read waitlist site rewards'
    ) THEN
        CREATE POLICY "Public read waitlist site rewards"
            ON storage.objects FOR SELECT TO anon, authenticated
            USING (bucket_id = 'waitlist-site-rewards');
    END IF;
END;
$$;

ALTER TABLE public.market_waitlist
    DROP CONSTRAINT IF EXISTS market_waitlist_service_area_status_check,
    ADD CONSTRAINT market_waitlist_service_area_status_check
        CHECK (service_area_status IN ('in_area', 'outside_area', 'unknown')),
    DROP CONSTRAINT IF EXISTS market_waitlist_preferred_contact_method_check,
    ADD CONSTRAINT market_waitlist_preferred_contact_method_check
        CHECK (preferred_contact_method IS NULL OR preferred_contact_method IN ('email', 'sms', 'whatsapp')),
    DROP CONSTRAINT IF EXISTS market_waitlist_order_frequency_check,
    ADD CONSTRAINT market_waitlist_order_frequency_check
        CHECK (order_frequency IS NULL OR order_frequency IN ('weekly', 'few_monthly', 'monthly', 'occasions', 'depends')),
    DROP CONSTRAINT IF EXISTS market_waitlist_age_group_check,
    ADD CONSTRAINT market_waitlist_age_group_check
        CHECK (age_group IS NULL OR age_group IN ('18_20', '21_24', '25_34', '35_44', '45_plus')),
    DROP CONSTRAINT IF EXISTS market_waitlist_reward_path_check,
    ADD CONSTRAINT market_waitlist_reward_path_check
        CHECK (reward_path IS NULL OR reward_path IN ('wine', 'adventure', 'music'));

CREATE INDEX IF NOT EXISTS market_waitlist_status_created_idx
    ON public.market_waitlist (status, created_at DESC);
CREATE INDEX IF NOT EXISTS market_waitlist_service_area_idx
    ON public.market_waitlist (service_area_status, country, county, city, area);
CREATE INDEX IF NOT EXISTS market_waitlist_age_group_idx
    ON public.market_waitlist (age_group, created_at DESC);
CREATE INDEX IF NOT EXISTS market_waitlist_reward_path_idx
    ON public.market_waitlist (reward_path, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_waitlist_intelligence()
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'total', count(*),
        'inArea', count(*) FILTER (WHERE service_area_status = 'in_area'),
        'outsideArea', count(*) FILTER (WHERE service_area_status = 'outside_area'),
        'unknownArea', count(*) FILTER (WHERE service_area_status = 'unknown'),
        'emailOptIns', count(*) FILTER (WHERE email_updates_consent AND status <> 'UNSUBSCRIBED'),
        'smsOptIns', count(*) FILTER (WHERE sms_consent AND status <> 'UNSUBSCRIBED'),
        'whatsappOptIns', count(*) FILTER (WHERE whatsapp_consent AND status <> 'UNSUBSCRIBED'),
        'ageGroups', (
            SELECT jsonb_agg(jsonb_build_object('group', age_bands.group_id, 'label', age_bands.label, 'count', age_bands.member_count)
                ORDER BY age_bands.sort_order)
            FROM (
                SELECT bands.group_id, bands.label, bands.sort_order, count(waitlist.id)::BIGINT AS member_count
                FROM (VALUES
                    ('18_20', '18–20', 1),
                    ('21_24', '21–24', 2),
                    ('25_34', '25–34', 3),
                    ('35_44', '35–44', 4),
                    ('45_plus', '45+', 5)
                ) AS bands(group_id, label, sort_order)
                LEFT JOIN public.market_waitlist AS waitlist ON waitlist.age_group = bands.group_id
                GROUP BY bands.group_id, bands.label, bands.sort_order
            ) AS age_bands
        ),
        'rewardPaths', (
            SELECT jsonb_agg(jsonb_build_object('path', paths.path_id, 'label', paths.label, 'count', paths.member_count)
                ORDER BY paths.sort_order)
            FROM (
                SELECT options.path_id, options.label, options.sort_order,
                    count(waitlist.id)::BIGINT AS member_count
                FROM (VALUES
                    ('wine', 'Wine tastings & curated gifts', 1),
                    ('adventure', 'Hosted adventures for two', 2),
                    ('music', 'Soul Fest ticket draw', 3)
                ) AS options(path_id, label, sort_order)
                LEFT JOIN public.market_waitlist AS waitlist ON waitlist.reward_path = options.path_id
                GROUP BY options.path_id, options.label, options.sort_order
            ) AS paths
        ),
        'areas', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'country', area_counts.country,
                'county', area_counts.county,
                'city', area_counts.city,
                'area', area_counts.area,
                'total', area_counts.total,
                'inArea', area_counts.in_area
            ) ORDER BY area_counts.total DESC, area_counts.area)
            FROM (
                SELECT country, county, city, area,
                    count(*)::BIGINT AS total,
                    count(*) FILTER (WHERE service_area_status = 'in_area')::BIGINT AS in_area
                FROM public.market_waitlist
                GROUP BY country, county, city, area
                ORDER BY count(*) DESC
                LIMIT 100
            ) area_counts
        ), '[]'::JSONB),
        'interests', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('name', interest, 'count', interest_count)
                ORDER BY interest_count DESC, interest)
            FROM (
                SELECT interest, count(*)::BIGINT AS interest_count
                FROM public.market_waitlist waitlist
                CROSS JOIN LATERAL unnest(waitlist.product_interests) AS interests(interest)
                GROUP BY interest
                ORDER BY count(*) DESC
            ) interest_counts
        ), '[]'::JSONB)
    )
    FROM public.market_waitlist;
$$;

REVOKE ALL ON FUNCTION public.get_waitlist_intelligence() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_waitlist_intelligence() TO service_role;

CREATE TABLE IF NOT EXISTS public.waitlist_site_analytics_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id UUID NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('page_open', 'age_group_selected', 'music_started', 'music_heard_80')),
    age_group TEXT CHECK (age_group IS NULL OR age_group IN ('18_20', '21_24', '25_34', '35_44', '45_plus')),
    music_genre TEXT CHECK (music_genre IS NULL OR music_genre IN ('reggae', 'genge', 'gengetone', 'soul', 'rnb', 'classic', 'love_romance', 'afrobeats', 'hip_hop', 'pop', 'other')),
    track_title TEXT CHECK (track_title IS NULL OR length(track_title) <= 120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (
        (event_type IN ('music_started', 'music_heard_80') AND age_group IS NOT NULL AND track_title IS NOT NULL)
        OR (event_type NOT IN ('music_started', 'music_heard_80') AND track_title IS NULL)
    )
);

ALTER TABLE public.waitlist_site_analytics_events
    ADD COLUMN IF NOT EXISTS music_genre TEXT CHECK (music_genre IS NULL OR music_genre IN ('reggae', 'genge', 'gengetone', 'soul', 'rnb', 'classic', 'love_romance', 'afrobeats', 'hip_hop', 'pop', 'other'));

CREATE INDEX IF NOT EXISTS waitlist_site_analytics_created_type_idx
    ON public.waitlist_site_analytics_events (created_at DESC, event_type);
CREATE INDEX IF NOT EXISTS waitlist_site_analytics_music_idx
    ON public.waitlist_site_analytics_events (age_group, track_title, created_at DESC)
    WHERE event_type IN ('music_started', 'music_heard_80');

ALTER TABLE public.waitlist_site_analytics_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.waitlist_site_analytics_events FROM PUBLIC, anon, authenticated;
GRANT INSERT, SELECT ON public.waitlist_site_analytics_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.waitlist_site_analytics_events_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.get_waitlist_site_analytics(p_since TIMESTAMPTZ DEFAULT now() - INTERVAL '30 days')
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'page_opens', (
            SELECT count(*)::BIGINT
            FROM public.waitlist_site_analytics_events
            WHERE event_type = 'page_open' AND created_at >= COALESCE(p_since, now() - INTERVAL '30 days')
        ),
        'unique_visitors', (
            SELECT count(DISTINCT session_id)::BIGINT
            FROM public.waitlist_site_analytics_events
            WHERE event_type = 'page_open' AND created_at >= COALESCE(p_since, now() - INTERVAL '30 days')
        ),
        'age_groups', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('group', bands.group_id, 'label', bands.label, 'visitors', bands.visitors)
                ORDER BY bands.sort_order)
            FROM (
                SELECT age_bands.group_id, age_bands.label, age_bands.sort_order,
                    count(DISTINCT events.session_id)::BIGINT AS visitors
                FROM (VALUES
                    ('18_20', '18–20', 1),
                    ('21_24', '21–24', 2),
                    ('25_34', '25–34', 3),
                    ('35_44', '35–44', 4),
                    ('45_plus', '45+', 5)
                ) AS age_bands(group_id, label, sort_order)
                LEFT JOIN public.waitlist_site_analytics_events AS events
                    ON events.age_group = age_bands.group_id
                    AND events.event_type = 'age_group_selected'
                    AND events.created_at >= COALESCE(p_since, now() - INTERVAL '30 days')
                GROUP BY age_bands.group_id, age_bands.label, age_bands.sort_order
            ) AS bands
        ), '[]'::JSONB),
        'music', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'age_group', music.age_group,
                'music_genre', music.music_genre,
                'track_title', music.track_title,
                'starts', music.starts,
                'heard_80', music.heard_80,
                'listeners', music.listeners
            ) ORDER BY music.age_group, music.heard_80::NUMERIC / GREATEST(music.starts, 1) DESC, music.starts DESC)
            FROM (
                SELECT age_group, music_genre, track_title,
                    count(*) FILTER (WHERE event_type = 'music_started')::BIGINT AS starts,
                    count(*) FILTER (WHERE event_type = 'music_heard_80')::BIGINT AS heard_80,
                    count(DISTINCT session_id) FILTER (WHERE event_type = 'music_started')::BIGINT AS listeners
                FROM public.waitlist_site_analytics_events
                WHERE event_type IN ('music_started', 'music_heard_80')
                    AND created_at >= COALESCE(p_since, now() - INTERVAL '30 days')
                GROUP BY age_group, music_genre, track_title
            ) AS music
        ), '[]'::JSONB),
        'locations', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'country', areas.country,
                'county', areas.county,
                'city', areas.city,
                'area', areas.area,
                'signups', areas.signups
            ) ORDER BY areas.signups DESC, areas.city, areas.area)
            FROM (
                SELECT country, county, city, area, count(*)::BIGINT AS signups
                FROM public.market_waitlist
                WHERE created_at >= COALESCE(p_since, now() - INTERVAL '30 days')
                GROUP BY country, county, city, area
                ORDER BY count(*) DESC
                LIMIT 100
            ) AS areas
        ), '[]'::JSONB)
    );
$$;

REVOKE ALL ON FUNCTION public.get_waitlist_site_analytics(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_waitlist_site_analytics(TIMESTAMPTZ) TO service_role;

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
    WHERE regexp_replace(lower(trim(full_name)), '[[:space:][:punct:]]', '', 'g')
            = regexp_replace(lower(trim(p_full_name)), '[[:space:][:punct:]]', '', 'g')
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

REVOKE ALL ON FUNCTION public.restore_waitlist_member_session(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_waitlist_member_session(TEXT, TEXT, TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
