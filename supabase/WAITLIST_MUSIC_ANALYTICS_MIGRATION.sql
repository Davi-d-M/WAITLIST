-- Apply after WAITLIST_SITE_MIGRATION.sql in the shared Supabase project.
-- This focused patch enables anonymous music-style event writes and Admin counts
-- without reapplying the unrelated waitlist, referral, and member-session schema.

BEGIN;

CREATE TABLE IF NOT EXISTS public.waitlist_site_analytics_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    age_group TEXT,
    music_genre TEXT,
    track_title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.waitlist_site_analytics_events
    ADD COLUMN IF NOT EXISTS age_group TEXT,
    ADD COLUMN IF NOT EXISTS music_genre TEXT,
    ADD COLUMN IF NOT EXISTS track_title TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.waitlist_site_analytics_events
    DROP CONSTRAINT IF EXISTS waitlist_site_analytics_events_event_type_check,
    DROP CONSTRAINT IF EXISTS waitlist_site_analytics_events_age_group_check,
    DROP CONSTRAINT IF EXISTS waitlist_site_analytics_events_music_genre_check,
    DROP CONSTRAINT IF EXISTS waitlist_site_analytics_events_track_title_check,
    DROP CONSTRAINT IF EXISTS waitlist_site_analytics_events_check,
    DROP CONSTRAINT IF EXISTS waitlist_site_analytics_event_shape_check,
    ADD CONSTRAINT waitlist_site_analytics_events_event_type_check
        CHECK (event_type IN ('page_open', 'age_group_selected', 'music_genre_selected', 'music_started', 'music_heard_80')),
    ADD CONSTRAINT waitlist_site_analytics_events_age_group_check
        CHECK (age_group IS NULL OR age_group IN ('18_20', '21_24', '25_34', '35_44', '45_plus')),
    ADD CONSTRAINT waitlist_site_analytics_events_music_genre_check
        CHECK (music_genre IS NULL OR music_genre IN ('reggae', 'genge', 'gengetone', 'soul', 'rnb', 'classic', 'love_romance', 'afrobeats', 'hip_hop', 'pop', 'other')),
    ADD CONSTRAINT waitlist_site_analytics_events_track_title_check
        CHECK (track_title IS NULL OR length(track_title) <= 120),
    ADD CONSTRAINT waitlist_site_analytics_event_shape_check CHECK (
        (event_type IN ('music_started', 'music_heard_80') AND age_group IS NOT NULL AND track_title IS NOT NULL)
        OR (event_type = 'music_genre_selected' AND track_title IS NULL)
        OR (event_type IN ('page_open', 'age_group_selected') AND track_title IS NULL AND music_genre IS NULL)
    );

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
        'genre_picks', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'genre', genre_options.genre_id,
                'label', genre_options.label,
                'visitors', genre_options.visitors
            ) ORDER BY genre_options.sort_order)
            FROM (
                SELECT choices.genre_id, choices.label, choices.sort_order,
                    count(DISTINCT events.session_id)::BIGINT AS visitors
                FROM (VALUES
                    (NULL::TEXT, 'My age-group mix', 1),
                    ('reggae', 'Reggae', 2),
                    ('genge', 'Genge', 3),
                    ('gengetone', 'Gengetone', 4),
                    ('soul', 'Soul', 5),
                    ('rnb', 'R&B', 6),
                    ('classic', 'Classics', 7),
                    ('love_romance', 'Love & Romance', 8),
                    ('afrobeats', 'Afrobeats', 9),
                    ('hip_hop', 'Hip-hop', 10),
                    ('pop', 'Pop', 11),
                    ('other', 'Other', 12)
                ) AS choices(genre_id, label, sort_order)
                LEFT JOIN public.waitlist_site_analytics_events AS events
                    ON events.event_type = 'music_genre_selected'
                    AND events.music_genre IS NOT DISTINCT FROM choices.genre_id
                    AND events.created_at >= COALESCE(p_since, now() - INTERVAL '30 days')
                GROUP BY choices.genre_id, choices.label, choices.sort_order
            ) AS genre_options
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

COMMIT;
