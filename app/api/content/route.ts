import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
const campaignPhases = new Set(['signal', 'anticipation', 'invitation', 'final_call', 'aftermath']);
const experienceIds = new Set(['wine', 'adventure', 'music']);
const defaultCampaignSettings = {
  brandName: 'Midnight Society KE',
  brandDescriptor: 'KENYA · A PRIVATE WORLD OF EXPERIENCES',
  tagline: 'Some nights become stories.',
  subheadline: 'Others become legends.',
  presentedBy: 'Presented by ONLINE BAR · Nairobi, Kenya',
  instagramHandle: '@midnight.society.ke',
  ctaLabel: 'Claim your place',
  phase: 'signal',
  announcement: 'Nairobi, you’re on notice. Some nights you hear about the next morning. Some nights you wish you’d known about sooner. And some nights? You had to be there. The first chapter is coming. The details will be revealed as they’re confirmed. When the invitation drops, will you be on the list?',
  eventTitle: 'The first chapter is coming.',
  eventDetails: 'Music, experiences, unexpected moments and nights worth remembering. Join the list for confirmed updates.',
  venueNotice: 'Event details will be shared when they’re confirmed.',
  registrationUrl: '',
  registrationLabel: 'View confirmed event details',
  experiences: [
    { id: 'wine', title: 'Wine & good living', description: 'Curated wine experiences and good company.', icon: '◈', active: true },
    { id: 'adventure', title: 'Unexpected experiences', description: 'New places, new stories and shared moments.', icon: '✦', active: true },
    { id: 'music', title: 'Music & nights out', description: 'Live music and future Soul Fest updates.', icon: '♫', active: true }
  ]
};

function publishedCampaignSettings(raw: unknown) {
  const settings = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const experiences = Array.isArray(settings.experiences)
    ? settings.experiences.flatMap(experience => {
      if (!experience || typeof experience !== 'object' || Array.isArray(experience)) return [];
      const item = experience as Record<string, unknown>;
      if (typeof item.id !== 'string' || !experienceIds.has(item.id)
        || typeof item.title !== 'string' || typeof item.description !== 'string'
        || typeof item.icon !== 'string' || typeof item.active !== 'boolean') return [];
      return [{ id: item.id, title: item.title.slice(0, 80), description: item.description.slice(0, 240), icon: item.icon.slice(0, 8), active: item.active }];
    })
    : defaultCampaignSettings.experiences;
  const safeString = (key: string, maxLength: number) => {
    const value = settings[key];
    const fallback = defaultCampaignSettings[key as keyof typeof defaultCampaignSettings];
    return typeof value === 'string' ? value.slice(0, maxLength) : typeof fallback === 'string' ? fallback : '';
  };
  return {
    brandName: safeString('brandName', 80),
    brandDescriptor: safeString('brandDescriptor', 120),
    tagline: safeString('tagline', 120),
    subheadline: safeString('subheadline', 120),
    presentedBy: safeString('presentedBy', 120),
    instagramHandle: safeString('instagramHandle', 40),
    ctaLabel: safeString('ctaLabel', 60),
    phase: typeof settings.phase === 'string' && campaignPhases.has(settings.phase)
      ? settings.phase
      : defaultCampaignSettings.phase,
    announcement: safeString('announcement', 700),
    eventTitle: safeString('eventTitle', 120),
    eventDetails: safeString('eventDetails', 500),
    venueNotice: safeString('venueNotice', 180),
    registrationUrl: typeof settings.registrationUrl === 'string' && (() => {
      try { return new URL(settings.registrationUrl).protocol === 'https:'; } catch { return false; }
    })() ? settings.registrationUrl.slice(0, 500) : '',
    registrationLabel: safeString('registrationLabel', 60),
    experiences
  };
}

function isMissingGenreColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return ['42703', 'PGRST200', 'PGRST204'].includes(error.code || '')
    && (error.message || '').toLowerCase().includes('genre_tracks');
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    const missing = [
      !url && 'NEXT_PUBLIC_SUPABASE_URL',
      !key && 'SUPABASE_SERVICE_ROLE_KEY'
    ].filter((name): name is string => Boolean(name));
    console.error(`[WaitlistSite] Missing server environment variables: ${missing.join(', ')}`);
    return NextResponse.json({
      error: `Website content is not configured. Add ${missing.join(' and ')} to this Vercel project's Environment Variables for Production, then redeploy.`
    }, { status: 503 });
  }
  const database = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  let { data, error } = await database.from('waitlist_site_content')
    .select('eyebrow,headline,intro,benefit_one,benefit_two,benefit_three,hero_image_url,hero_image_alt,age_group_tracks,genre_tracks,campaign_settings,launch_at,tokens_per_referral')
    .eq('id', 'default')
    .maybeSingle();
  if (isMissingGenreColumn(error)) {
    const legacyResult = await database.from('waitlist_site_content')
      .select('eyebrow,headline,intro,benefit_one,benefit_two,benefit_three,hero_image_url,hero_image_alt,age_group_tracks,campaign_settings,launch_at,tokens_per_referral')
      .eq('id', 'default')
      .maybeSingle();
    if (legacyResult.error) {
      error = legacyResult.error;
    } else {
      data = legacyResult.data ? { ...legacyResult.data, genre_tracks: {} } : null;
      error = null;
    }
  }
  if (error) {
    console.error('[WaitlistSite] Could not load published website content:', error);
    if (error.code === '42P01' || error.code === 'PGRST205' || error.code === '42703' || error.code === 'PGRST204') {
      return NextResponse.json({
        error: 'Waitlist content storage is missing a required table or column. Run the latest supabase/WAITLIST_SITE_MIGRATION.sql in the Supabase project used by both the waitlist and Admin.'
      }, { status: 503 });
    }
    return NextResponse.json({ error: 'Published website content could not be loaded. Check the server logs and Supabase connection.' }, { status: 503 });
  }
  if (!data) {
    return NextResponse.json({
      error: 'Waitlist content is not initialized. Run supabase/WAITLIST_SITE_MIGRATION.sql in the Supabase project used by this site.'
    }, { status: 503 });
  }
  const allowedAgeGroups = new Set(['18_20', '21_24', '25_34', '35_44', '45_plus']);
  const rawTracks = data.age_group_tracks && typeof data.age_group_tracks === 'object'
    ? data.age_group_tracks as Record<string, { title?: unknown; url?: unknown }>
    : {};
  const ageGroupTracks = Object.fromEntries(
    Object.entries(rawTracks)
      .filter(([group, track]) => {
        if (!allowedAgeGroups.has(group) || !track || typeof track !== 'object'
          || typeof track.title !== 'string' || typeof track.url !== 'string') return false;
        try {
          return new URL(track.url).protocol === 'https:';
        } catch {
          return false;
        }
      })
      .map(([group, track]) => [group, { title: track.title, url: track.url }])
  );
  const allowedGenres = new Set(['reggae', 'genge', 'gengetone', 'soul', 'rnb', 'classic', 'love_romance', 'afrobeats', 'hip_hop', 'pop', 'other']);
  const rawGenreTracks = data.genre_tracks && typeof data.genre_tracks === 'object'
    ? data.genre_tracks as Record<string, { title?: unknown; url?: unknown }>
    : {};
  const genreTracks = Object.fromEntries(
    Object.entries(rawGenreTracks)
      .filter(([genre, track]) => {
        if (!allowedGenres.has(genre) || !track || typeof track !== 'object'
          || typeof track.title !== 'string' || typeof track.url !== 'string') return false;
        try {
          return new URL(track.url).protocol === 'https:';
        } catch {
          return false;
        }
      })
      .map(([genre, track]) => [genre, { title: track.title, url: track.url }])
  );
  const content = {
    eyebrow: data.eyebrow,
    headline: data.headline,
    intro: data.intro,
    benefit_one: data.benefit_one,
    benefit_two: data.benefit_two,
    benefit_three: data.benefit_three,
    hero_image_url: data.hero_image_url,
    hero_image_alt: data.hero_image_alt,
    campaign_settings: publishedCampaignSettings(data.campaign_settings),
    launch_at: data.launch_at,
    tokens_per_referral: 3
  };
  const { data: rewards, error: rewardsError } = await database.from('waitlist_site_rewards')
    .select('id,name,description,image_url,token_cost,sort_order')
    .eq('is_active', true)
    .order('sort_order')
    .order('created_at');
  if (rewardsError) {
    console.error('[WaitlistSite] Could not load published souvenirs:', rewardsError);
    return NextResponse.json({ error: 'Souvenir and widget content could not be loaded. Apply the waitlist site migration.' }, { status: 503 });
  }
  return NextResponse.json({ content: { ...content, age_group_tracks: ageGroupTracks, genre_tracks: genreTracks }, rewards: rewards || [] }, {
    headers: { 'Cache-Control': 'private, no-store, max-age=0' }
  });
}
