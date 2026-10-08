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
    ADD COLUMN IF NOT EXISTS consent_version TEXT,
    ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS age_group TEXT;

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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.waitlist_site_content
    ADD COLUMN IF NOT EXISTS age_group_tracks JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE public.waitlist_site_content ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.waitlist_site_content FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.waitlist_site_content TO service_role;

INSERT INTO public.waitlist_site_content (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

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
        CHECK (age_group IS NULL OR age_group IN ('18_20', '21_24', '25_34', '35_44', '45_plus'));

CREATE INDEX IF NOT EXISTS market_waitlist_status_created_idx
    ON public.market_waitlist (status, created_at DESC);
CREATE INDEX IF NOT EXISTS market_waitlist_service_area_idx
    ON public.market_waitlist (service_area_status, country, county, city, area);
CREATE INDEX IF NOT EXISTS market_waitlist_age_group_idx
    ON public.market_waitlist (age_group, created_at DESC);

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

NOTIFY pgrst, 'reload schema';
COMMIT;
