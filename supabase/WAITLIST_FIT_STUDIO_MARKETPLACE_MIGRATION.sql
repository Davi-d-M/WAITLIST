BEGIN;

CREATE TABLE IF NOT EXISTS public.fit_service_offerings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID REFERENCES public.fit_providers(id) ON DELETE SET NULL,
    service_key TEXT NOT NULL CHECK (service_key IN (
        'finding_outfit', 'styling', 'makeup_sfx', 'wig_hair',
        'props_accessories', 'tailoring', 'costume_maker',
        'inspiration_tutorials'
    )),
    title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 2 AND 120),
    description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
    image_path TEXT,
    image_url TEXT,
    price_kes INTEGER CHECK (price_kes IS NULL OR price_kes >= 0),
    available BOOLEAN NOT NULL DEFAULT true,
    published BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fit_booking_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.market_waitlist(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.fit_profiles(id) ON DELETE CASCADE,
    offering_id UUID NOT NULL REFERENCES public.fit_service_offerings(id) ON DELETE RESTRICT,
    member_message TEXT NOT NULL DEFAULT '' CHECK (char_length(member_message) <= 500),
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'confirmed', 'declined', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fit_booking_requests
    DROP CONSTRAINT IF EXISTS fit_booking_requests_member_id_offering_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS fit_booking_requests_one_active_offer_idx
    ON public.fit_booking_requests (member_id, offering_id)
    WHERE status NOT IN ('declined', 'cancelled');
CREATE INDEX IF NOT EXISTS fit_service_offerings_public_idx
    ON public.fit_service_offerings (service_key, updated_at DESC)
    WHERE published = true AND available = true;
CREATE INDEX IF NOT EXISTS fit_booking_requests_status_idx
    ON public.fit_booking_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS fit_booking_requests_member_idx
    ON public.fit_booking_requests (member_id, created_at DESC);

ALTER TABLE public.fit_service_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fit_booking_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fit_service_offerings, public.fit_booking_requests
    FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.fit_service_offerings, public.fit_booking_requests TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('fit-studio-listings', 'fit-studio-listings', true, 6291456, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE public.fit_studio_audit_log
    DROP CONSTRAINT IF EXISTS fit_studio_audit_log_action_check;
ALTER TABLE public.fit_studio_audit_log
    ADD CONSTRAINT fit_studio_audit_log_action_check CHECK (action IN (
        'view_queue', 'view_profile', 'update_profile', 'manage_provider',
        'manage_offering', 'update_booking', 'update_settings', 'export_profiles'
    ));

CREATE OR REPLACE FUNCTION public.log_waitlist_fit_studio_action(
    p_actor_email TEXT,
    p_action TEXT,
    p_profile_id UUID DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_action NOT IN (
        'view_queue', 'view_profile', 'update_profile', 'manage_provider',
        'manage_offering', 'update_booking', 'update_settings', 'export_profiles'
    ) THEN
        RAISE EXCEPTION 'Invalid Fit Studio audit action.';
    END IF;
    INSERT INTO public.fit_studio_audit_log (actor_email, action, profile_id, details)
    VALUES (
        left(coalesce(nullif(trim(p_actor_email), ''), 'admin'), 254),
        p_action, p_profile_id, coalesce(p_details, '{}'::JSONB)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.request_waitlist_fit_booking(
    p_member_id UUID,
    p_offering_id UUID,
    p_member_message TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    saved_request_id UUID;
    offering_service TEXT;
    member_profile_id UUID;
BEGIN
    IF char_length(coalesce(p_member_message, '')) > 500 THEN
        RAISE EXCEPTION 'Booking note is too long.';
    END IF;

    SELECT service_key INTO offering_service
    FROM public.fit_service_offerings
    WHERE id = p_offering_id AND published = true AND available = true;
    IF offering_service IS NULL THEN
        RAISE EXCEPTION 'This offering is not currently available.';
    END IF;

    SELECT profile.id INTO member_profile_id
    FROM public.fit_profiles AS profile
    JOIN public.fit_help_requests AS help ON help.profile_id = profile.id
    WHERE profile.member_id = p_member_id AND help.service_key = offering_service;
    IF member_profile_id IS NULL THEN
        RAISE EXCEPTION 'Save a Fit Studio profile requesting this service before booking.';
    END IF;

    INSERT INTO public.fit_booking_requests (
        member_id, profile_id, offering_id, member_message
    )
    VALUES (
        p_member_id, member_profile_id, p_offering_id,
        left(trim(coalesce(p_member_message, '')), 500)
    )
    RETURNING id INTO saved_request_id;
    RETURN saved_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_waitlist_fit_offering(
    p_offering_id UUID,
    p_provider_id UUID,
    p_service_key TEXT,
    p_title TEXT,
    p_description TEXT,
    p_image_path TEXT,
    p_image_url TEXT,
    p_price_kes INTEGER,
    p_available BOOLEAN,
    p_published BOOLEAN,
    p_actor_email TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    saved_offering_id UUID;
BEGIN
    INSERT INTO public.fit_service_offerings (
        id, provider_id, service_key, title, description, image_path, image_url,
        price_kes, available, published, updated_at
    )
    VALUES (
        coalesce(p_offering_id, gen_random_uuid()), p_provider_id, p_service_key,
        trim(p_title), coalesce(p_description, ''), p_image_path, p_image_url,
        p_price_kes, coalesce(p_available, false), coalesce(p_published, false), now()
    )
    ON CONFLICT (id) DO UPDATE SET
        provider_id = EXCLUDED.provider_id,
        service_key = EXCLUDED.service_key,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        image_path = EXCLUDED.image_path,
        image_url = EXCLUDED.image_url,
        price_kes = EXCLUDED.price_kes,
        available = EXCLUDED.available,
        published = EXCLUDED.published,
        updated_at = now()
    RETURNING id INTO saved_offering_id;

    INSERT INTO public.fit_studio_audit_log (actor_email, action, profile_id, details)
    VALUES (
        left(coalesce(nullif(trim(p_actor_email), ''), 'admin'), 254),
        'manage_offering', NULL,
        jsonb_build_object('offering_id', saved_offering_id, 'service_key', p_service_key)
    );
    RETURN saved_offering_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_waitlist_fit_booking(
    p_booking_id UUID,
    p_status TEXT,
    p_actor_email TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_status NOT IN ('new', 'reviewing', 'confirmed', 'declined', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid booking status.';
    END IF;

    UPDATE public.fit_booking_requests
    SET status = p_status, updated_at = now()
    WHERE id = p_booking_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking request not found.';
    END IF;

    INSERT INTO public.fit_studio_audit_log (actor_email, action, profile_id, details)
    VALUES (
        left(coalesce(nullif(trim(p_actor_email), ''), 'admin'), 254),
        'update_booking', NULL,
        jsonb_build_object('booking_id', p_booking_id, 'status', p_status)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.log_waitlist_fit_studio_action(TEXT, TEXT, UUID, JSONB)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_waitlist_fit_studio_action(TEXT, TEXT, UUID, JSONB)
    TO service_role;
REVOKE ALL ON FUNCTION public.request_waitlist_fit_booking(UUID, UUID, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_waitlist_fit_booking(UUID, UUID, TEXT)
    TO service_role;
REVOKE ALL ON FUNCTION public.save_waitlist_fit_offering(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, BOOLEAN, BOOLEAN, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_waitlist_fit_offering(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, BOOLEAN, BOOLEAN, TEXT)
    TO service_role;
REVOKE ALL ON FUNCTION public.update_waitlist_fit_booking(UUID, TEXT, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_waitlist_fit_booking(UUID, TEXT, TEXT)
    TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
