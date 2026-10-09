import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

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
  const { data, error } = await database.from('waitlist_site_content')
    .select('eyebrow,headline,intro,benefit_one,benefit_two,benefit_three,hero_image_url,hero_image_alt,age_group_tracks,genre_tracks,launch_at,tokens_per_referral')
    .eq('id', 'default')
    .maybeSingle();
  if (error) {
    console.error('[WaitlistSite] Could not load published website content:', error);
    if (error.code === '42P01' || error.code === 'PGRST205') {
      return NextResponse.json({
        error: 'Waitlist content storage is not set up. Run supabase/WAITLIST_SITE_MIGRATION.sql in the Supabase project used by this site.'
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
    launch_at: data.launch_at,
    tokens_per_referral: data.tokens_per_referral
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
