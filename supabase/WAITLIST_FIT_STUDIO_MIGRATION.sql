BEGIN;

CREATE TABLE IF NOT EXISTS public.fit_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 120),
    service_key TEXT NOT NULL CHECK (service_key IN (
        'finding_outfit', 'styling', 'makeup_sfx', 'wig_hair',
        'props_accessories', 'tailoring', 'costume_maker',
        'inspiration_tutorials'
    )),
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    notes TEXT NOT NULL DEFAULT '',
    verified BOOLEAN NOT NULL DEFAULT false,
    available BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fit_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL UNIQUE
        REFERENCES public.market_waitlist(id) ON DELETE CASCADE,
    concept TEXT NOT NULL CHECK (concept IN (
        'character_cosplay', 'horror_halloween', 'original_outfit',
        'group_duo', 'undecided'
    )),
    character_theme TEXT CHECK (
        character_theme IS NULL OR char_length(character_theme) <= 120
    ),
    outfit_status TEXT NOT NULL CHECK (outfit_status IN (
        'fully_ready', 'idea_needs_help', 'source_most',
        'finishing_touches', 'undecided'
    )),
    budget_range TEXT CHECK (budget_range IS NULL OR budget_range IN (
        'under_2000', 'kes_2000_5000', 'kes_5000_10000',
        'above_10000', 'need_ideas'
    )),
    group_plan TEXT NOT NULL CHECK (group_plan IN (
        'solo', 'partner', 'group', 'find_group'
    )),
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
        'new', 'reviewing', 'matched', 'in_progress', 'completed', 'closed'
    )),
    provider_id UUID REFERENCES public.fit_providers(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fit_help_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.fit_profiles(id) ON DELETE CASCADE,
    service_key TEXT NOT NULL CHECK (service_key IN (
        'finding_outfit', 'styling', 'makeup_sfx', 'wig_hair',
        'props_accessories', 'tailoring', 'costume_maker',
        'inspiration_tutorials'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (profile_id, service_key)
);

CREATE TABLE IF NOT EXISTS public.fit_consent_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.market_waitlist(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL CHECK (purpose IN ('fit_service_updates', 'provider_introduction')),
    channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')),
    granted BOOLEAN NOT NULL,
    notice_version TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'fit_studio',
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    withdrawn_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.fit_studio_settings (
    id TEXT PRIMARY KEY CHECK (id = 'default'),
    title TEXT NOT NULL DEFAULT 'Midnight Fit Studio',
    intro TEXT NOT NULL DEFAULT 'Tell us what you are planning and what help would make your Halloween look come together. This is optional.',
    merchant_notice TEXT NOT NULL DEFAULT 'We are listening to what you want and working with merchants to source the styles and services members ask for. Provider availability and prices must be confirmed; no match is guaranteed.',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.fit_studio_settings (id) VALUES ('default')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.fit_studio_audit_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_email TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN (
        'view_queue', 'view_profile', 'update_profile', 'manage_provider',
        'update_settings', 'export_profiles'
    )),
    profile_id UUID REFERENCES public.fit_profiles(id) ON DELETE SET NULL,
    details JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fit_profiles_status_created_idx
    ON public.fit_profiles (status, created_at DESC);
CREATE INDEX IF NOT EXISTS fit_profiles_concept_idx
    ON public.fit_profiles (concept);
CREATE INDEX IF NOT EXISTS fit_profiles_budget_idx
    ON public.fit_profiles (budget_range);
CREATE INDEX IF NOT EXISTS fit_help_requests_service_idx
    ON public.fit_help_requests (service_key, profile_id);
CREATE INDEX IF NOT EXISTS fit_consent_member_purpose_idx
    ON public.fit_consent_records (member_id, purpose, channel, captured_at DESC);
CREATE INDEX IF NOT EXISTS fit_audit_created_idx
    ON public.fit_studio_audit_log (created_at DESC);

ALTER TABLE public.fit_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fit_help_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fit_consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fit_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fit_studio_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fit_studio_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.fit_profiles, public.fit_help_requests,
    public.fit_consent_records, public.fit_providers,
    public.fit_studio_settings, public.fit_studio_audit_log
    FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.fit_profiles, public.fit_help_requests,
    public.fit_consent_records, public.fit_providers,
    public.fit_studio_settings, public.fit_studio_audit_log
    TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.fit_studio_audit_log_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.save_waitlist_fit_profile(
    p_member_id UUID,
    p_concept TEXT,
    p_character_theme TEXT,
    p_outfit_status TEXT,
    p_help_requested TEXT[],
    p_budget_range TEXT,
    p_group_plan TEXT,
    p_wants_fit_service_updates BOOLEAN,
    p_consent_channels TEXT[],
    p_wants_provider_introduction BOOLEAN,
    p_provider_channels TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    saved_profile_id UUID;
    safe_channels TEXT[];
    safe_provider_channels TEXT[];
    consent_purpose TEXT;
    requested_channels TEXT[];
BEGIN
    IF p_concept NOT IN ('character_cosplay', 'horror_halloween', 'original_outfit', 'group_duo', 'undecided')
       OR p_outfit_status NOT IN ('fully_ready', 'idea_needs_help', 'source_most', 'finishing_touches', 'undecided')
       OR p_group_plan NOT IN ('solo', 'partner', 'group', 'find_group')
       OR coalesce(array_length(p_help_requested, 1), 0) NOT BETWEEN 1 AND 8
       OR EXISTS (
           SELECT 1 FROM unnest(p_help_requested) AS selected(service_key)
           WHERE selected.service_key NOT IN (
               'finding_outfit', 'styling', 'makeup_sfx', 'wig_hair',
               'props_accessories', 'tailoring', 'costume_maker',
               'inspiration_tutorials'
           )
       )
       OR (p_budget_range IS NOT NULL AND p_budget_range NOT IN (
           'under_2000', 'kes_2000_5000', 'kes_5000_10000',
           'above_10000', 'need_ideas'
       ))
       OR (p_character_theme IS NOT NULL AND char_length(p_character_theme) > 120)
       OR coalesce(array_length(p_consent_channels, 1), 0) > 3
       OR EXISTS (
           SELECT 1 FROM unnest(p_consent_channels) AS selected(channel)
           WHERE selected.channel NOT IN ('email', 'sms', 'whatsapp')
       )
       OR (p_wants_fit_service_updates AND coalesce(array_length(p_consent_channels, 1), 0) = 0)
       OR coalesce(array_length(p_provider_channels, 1), 0) > 3
       OR EXISTS (
           SELECT 1 FROM unnest(p_provider_channels) AS selected(channel)
           WHERE selected.channel NOT IN ('email', 'sms', 'whatsapp')
       )
       OR (p_wants_provider_introduction AND coalesce(array_length(p_provider_channels, 1), 0) = 0)
    THEN
        RAISE EXCEPTION 'Invalid Fit Studio profile or consent values.';
    END IF;

    safe_channels := CASE WHEN p_wants_fit_service_updates THEN p_consent_channels ELSE '{}'::TEXT[] END;
    safe_provider_channels := CASE WHEN p_wants_provider_introduction THEN p_provider_channels ELSE '{}'::TEXT[] END;

    INSERT INTO public.fit_profiles (
        member_id, concept, character_theme, outfit_status, budget_range, group_plan, updated_at
    )
    VALUES (
        p_member_id, p_concept, nullif(trim(p_character_theme), ''),
        p_outfit_status, p_budget_range, p_group_plan, now()
    )
    ON CONFLICT (member_id) DO UPDATE SET
        concept = EXCLUDED.concept,
        character_theme = EXCLUDED.character_theme,
        outfit_status = EXCLUDED.outfit_status,
        budget_range = EXCLUDED.budget_range,
        group_plan = EXCLUDED.group_plan,
        updated_at = now()
    RETURNING id INTO saved_profile_id;

    DELETE FROM public.fit_help_requests WHERE profile_id = saved_profile_id;
    INSERT INTO public.fit_help_requests (profile_id, service_key)
    SELECT saved_profile_id, selected.service_key
    FROM (SELECT DISTINCT unnest(p_help_requested) AS service_key) AS selected;

    FOR consent_purpose, requested_channels IN
        SELECT consent_options.purpose, consent_options.channels
        FROM (VALUES
            ('fit_service_updates'::TEXT, safe_channels),
            ('provider_introduction'::TEXT, safe_provider_channels)
        ) AS consent_options(purpose, channels)
    LOOP
        INSERT INTO public.fit_consent_records (
            member_id, purpose, channel, granted, notice_version, source, withdrawn_at
        )
        SELECT p_member_id, consent_purpose, current_state.channel,
               false, 'fit-studio-v1', 'fit_studio', now()
        FROM (
            SELECT DISTINCT ON (channel) channel, granted
            FROM public.fit_consent_records
            WHERE member_id = p_member_id AND purpose = consent_purpose
            ORDER BY channel, captured_at DESC, id DESC
        ) AS current_state
        WHERE current_state.granted = true
          AND NOT (current_state.channel = ANY(requested_channels));

        INSERT INTO public.fit_consent_records (
            member_id, purpose, channel, granted, notice_version, source
        )
        SELECT p_member_id, consent_purpose, selected.channel,
               true, 'fit-studio-v1', 'fit_studio'
        FROM (SELECT DISTINCT unnest(requested_channels) AS channel) AS selected
        WHERE NOT EXISTS (
            SELECT 1
            FROM (
                SELECT DISTINCT ON (channel) channel, granted
                FROM public.fit_consent_records
                WHERE member_id = p_member_id AND purpose = consent_purpose
                ORDER BY channel, captured_at DESC, id DESC
            ) AS current_state
            WHERE current_state.channel = selected.channel
              AND current_state.granted = true
        );
    END LOOP;

    RETURN saved_profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_waitlist_fit_profile(
    p_profile_id UUID,
    p_next_status TEXT,
    p_provider_id UUID,
    p_actor_email TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    previous_status TEXT;
BEGIN
    IF p_next_status NOT IN ('new', 'reviewing', 'matched', 'in_progress', 'completed', 'closed') THEN
        RAISE EXCEPTION 'Invalid Fit Studio status.';
    END IF;

    SELECT status INTO previous_status
    FROM public.fit_profiles WHERE id = p_profile_id FOR UPDATE;
    IF previous_status IS NULL THEN
        RAISE EXCEPTION 'Fit Studio profile not found.';
    END IF;

    IF p_provider_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.fit_providers provider
        JOIN public.fit_help_requests help ON help.profile_id = p_profile_id
        WHERE provider.id = p_provider_id
          AND provider.verified = true
          AND provider.available = true
          AND provider.service_key = help.service_key
    ) THEN
        RAISE EXCEPTION 'Choose an available, verified provider for a requested service.';
    END IF;
    IF p_next_status = 'matched' AND p_provider_id IS NULL THEN
        RAISE EXCEPTION 'Assign a verified provider before marking a request matched.';
    END IF;
    IF p_next_status = 'matched' AND NOT EXISTS (
        SELECT 1
        FROM (
            SELECT DISTINCT ON (channel) channel, granted
            FROM public.fit_consent_records
            WHERE member_id = (SELECT member_id FROM public.fit_profiles WHERE id = p_profile_id)
              AND purpose = 'provider_introduction'
            ORDER BY channel, captured_at DESC, id DESC
        ) AS current_consent
        WHERE current_consent.granted = true
    ) THEN
        RAISE EXCEPTION 'The member must opt in to a provider introduction before being marked matched.';
    END IF;

    UPDATE public.fit_profiles
    SET status = p_next_status, provider_id = p_provider_id, updated_at = now()
    WHERE id = p_profile_id;

    INSERT INTO public.fit_studio_audit_log (actor_email, action, profile_id, details)
    VALUES (
        left(coalesce(nullif(trim(p_actor_email), ''), 'admin'), 254),
        'update_profile', p_profile_id,
        jsonb_build_object('previous_status', previous_status, 'next_status', p_next_status,
            'provider_id', p_provider_id)
    );
END;
$$;

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
    IF p_action NOT IN ('view_queue', 'view_profile', 'manage_provider', 'update_settings', 'export_profiles') THEN
        RAISE EXCEPTION 'Invalid Fit Studio audit action.';
    END IF;
    INSERT INTO public.fit_studio_audit_log (actor_email, action, profile_id, details)
    VALUES (left(coalesce(nullif(trim(p_actor_email), ''), 'admin'), 254),
        p_action, p_profile_id, coalesce(p_details, '{}'::JSONB));
END;
$$;

CREATE OR REPLACE FUNCTION public.save_waitlist_fit_provider(
    p_provider_id UUID,
    p_name TEXT,
    p_service_key TEXT,
    p_contact_name TEXT,
    p_email TEXT,
    p_phone TEXT,
    p_notes TEXT,
    p_verified BOOLEAN,
    p_available BOOLEAN,
    p_actor_email TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    saved_provider_id UUID;
BEGIN
    IF char_length(trim(p_name)) NOT BETWEEN 2 AND 120
       OR p_service_key NOT IN (
           'finding_outfit', 'styling', 'makeup_sfx', 'wig_hair',
           'props_accessories', 'tailoring', 'costume_maker',
           'inspiration_tutorials'
       )
       OR char_length(coalesce(p_contact_name, '')) > 120
       OR char_length(coalesce(p_email, '')) > 254
       OR char_length(coalesce(p_phone, '')) > 32
       OR char_length(coalesce(p_notes, '')) > 1000
    THEN
        RAISE EXCEPTION 'Invalid Fit Studio provider details.';
    END IF;

    IF p_provider_id IS NULL THEN
        INSERT INTO public.fit_providers (
            name, service_key, contact_name, email, phone, notes, verified, available
        )
        VALUES (
            trim(p_name), p_service_key, nullif(trim(p_contact_name), ''),
            nullif(trim(p_email), ''), nullif(trim(p_phone), ''),
            coalesce(p_notes, ''), p_verified, p_available
        )
        RETURNING id INTO saved_provider_id;
    ELSE
        UPDATE public.fit_providers SET
            name = trim(p_name),
            service_key = p_service_key,
            contact_name = nullif(trim(p_contact_name), ''),
            email = nullif(trim(p_email), ''),
            phone = nullif(trim(p_phone), ''),
            notes = coalesce(p_notes, ''),
            verified = p_verified,
            available = p_available,
            updated_at = now()
        WHERE id = p_provider_id
        RETURNING id INTO saved_provider_id;
        IF saved_provider_id IS NULL THEN
            RAISE EXCEPTION 'Fit Studio provider not found.';
        END IF;
    END IF;

    INSERT INTO public.fit_studio_audit_log (actor_email, action, details)
    VALUES (left(coalesce(nullif(trim(p_actor_email), ''), 'admin'), 254),
        'manage_provider', jsonb_build_object('provider_id', saved_provider_id));
    RETURN saved_provider_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_waitlist_fit_studio_settings(
    p_title TEXT,
    p_intro TEXT,
    p_merchant_notice TEXT,
    p_actor_email TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF char_length(trim(p_title)) NOT BETWEEN 2 AND 100
       OR char_length(trim(p_intro)) NOT BETWEEN 10 AND 500
       OR char_length(trim(p_merchant_notice)) NOT BETWEEN 10 AND 500
    THEN
        RAISE EXCEPTION 'Enter valid Fit Studio public copy.';
    END IF;
    UPDATE public.fit_studio_settings SET
        title = trim(p_title), intro = trim(p_intro),
        merchant_notice = trim(p_merchant_notice), updated_at = now()
    WHERE id = 'default';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Fit Studio settings were not initialized.';
    END IF;
    INSERT INTO public.fit_studio_audit_log (actor_email, action, details)
    VALUES (left(coalesce(nullif(trim(p_actor_email), ''), 'admin'), 254),
        'update_settings', jsonb_build_object('settings_id', 'default'));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_waitlist_fit_studio_metrics()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'totalProfiles', (SELECT count(*) FROM public.fit_profiles),
        'newRequests', (SELECT count(*) FROM public.fit_profiles WHERE status = 'new'),
        'needingHelp', (SELECT count(*) FROM public.fit_profiles WHERE outfit_status <> 'fully_ready'),
        'matched', (SELECT count(*) FROM public.fit_profiles WHERE status = 'matched'),
        'followupOptIns', (
            SELECT count(DISTINCT current.member_id)
            FROM (
                SELECT DISTINCT ON (member_id, channel) member_id, channel, granted
                FROM public.fit_consent_records
                WHERE purpose = 'fit_service_updates'
                ORDER BY member_id, channel, captured_at DESC, id DESC
            ) AS current
            WHERE current.granted = true
        ),
        'byStatus', coalesce((
            SELECT jsonb_object_agg(status, amount)
            FROM (SELECT status, count(*) AS amount FROM public.fit_profiles GROUP BY status) AS totals
        ), '{}'::JSONB),
        'byReadiness', coalesce((
            SELECT jsonb_object_agg(outfit_status, amount)
            FROM (SELECT outfit_status, count(*) AS amount FROM public.fit_profiles GROUP BY outfit_status) AS totals
        ), '{}'::JSONB),
        'byBudget', coalesce((
            SELECT jsonb_object_agg(coalesce(budget_range, 'not_specified'), amount)
            FROM (SELECT budget_range, count(*) AS amount FROM public.fit_profiles GROUP BY budget_range) AS totals
        ), '{}'::JSONB),
        'byService', coalesce((
            SELECT jsonb_object_agg(service_key, amount)
            FROM (SELECT service_key, count(*) AS amount FROM public.fit_help_requests GROUP BY service_key) AS totals
        ), '{}'::JSONB)
    );
$$;

REVOKE ALL ON FUNCTION public.save_waitlist_fit_profile(UUID, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, BOOLEAN, TEXT[], BOOLEAN, TEXT[])
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_waitlist_fit_profile(UUID, TEXT, UUID, TEXT)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_waitlist_fit_studio_action(TEXT, TEXT, UUID, JSONB)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_waitlist_fit_provider(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_waitlist_fit_studio_settings(TEXT, TEXT, TEXT, TEXT)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_waitlist_fit_studio_metrics()
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_waitlist_fit_profile(UUID, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, BOOLEAN, TEXT[], BOOLEAN, TEXT[])
    TO service_role;
GRANT EXECUTE ON FUNCTION public.update_waitlist_fit_profile(UUID, TEXT, UUID, TEXT)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.log_waitlist_fit_studio_action(TEXT, TEXT, UUID, JSONB)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.save_waitlist_fit_provider(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.update_waitlist_fit_studio_settings(TEXT, TEXT, TEXT, TEXT)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.get_waitlist_fit_studio_metrics()
    TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
